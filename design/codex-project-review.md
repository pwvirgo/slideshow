# Codex Project Review

## Purpose

This document records Codex's initial examination of the slideshow project in
August 2026. It is intended as a durable reference for the project's owner and
for future programmers or coding assistants.

This is an architectural and organizational review, not a specification. It
describes the project as it was found, identifies strengths and concerns, and
suggests directions for incremental improvement. No code changes were made as
part of the review.

## Project Overview

The project is a local-first photo slideshow and curation application. It began
as a fullscreen slideshow for files in a directory and evolved into a tool for
reviewing a database-backed photo collection.

The application can:

- Scan a folder and its subfolders for images.
- Query images from a SQLite database.
- Display images fullscreen with automatic advancement.
- Pause and navigate with the keyboard.
- Display database metadata for the current image.
- Record categories, ranks, and comments in a `notes` table.
- Stage and execute destructive actions through a separate workflow.

The system is designed primarily as a trusted, single-user application running
on the same computer as the image collection.

## Technology and Structure

The backend is written in TypeScript and runs directly in Deno. The frontend
uses plain HTML, CSS, and JavaScript. SQLite stores the photo catalog, notes,
and action history.

There is no build step, package manager, frontend framework, or external web
framework. The application is started with:

```bash
deno run --allow-read --allow-net --allow-write server.ts
```

The main areas of the repository are:

- `server.ts` -- HTTP server, routing, startup loading, and coordination.
- `lib/params.ts` -- parameter defaults, loading, and validation.
- `lib/scanner.ts` -- breadth-first folder scanning.
- `lib/db.ts` -- SQLite access and catalog operations.
- `lib/logger.ts` -- console and file logging.
- `static/app.js` -- slideshow, menus, metadata, notes, and keyboard behavior.
- `static/params.js` -- control-panel behavior.
- `static/*.html` -- slideshow and control-panel pages.
- `static/styles.css` -- shared visual styling.
- `scripts/executeDeletions.ts` -- dry-run and execution workflow for staged
  deletions.
- `design/` -- original requirements, operational documentation, and working
  notes from earlier development.

## Runtime Behavior

### Folder mode

Folder mode scans `imageFolderPath` breadth-first up to `maxDepth` and
`maxFiles`. Recognized formats are JPEG, PNG, GIF, and WebP. Images found in
each directory are sorted by filesystem creation time, falling back to
modification time.

The server stores relative image paths and serves them through `/images/*`.

### Database mode

Database mode opens the configured SQLite database and queries rows from
`fotos`. The query can include configured `WHERE` and `ORDER BY` fragments and
is limited by `maxFiles`.

The browser receives an ordered list of numeric image indexes. It requests the
physical image and metadata for an index through separate routes.

The principal database tables are:

- `fotos` -- the active image catalog.
- `notes` -- review categories, ranks, and comments.
- `actions` -- staged operations and their status.
- `deleted` -- catalog rows removed from `fotos`.

### Browser interface

The frontend is optimized for fullscreen and keyboard use:

- Space pauses or resumes.
- Left and right arrows navigate.
- Escape opens the menu.
- `I` toggles image information in database mode.
- `N` opens the notes form in database mode.

The next image is preloaded to reduce visible transitions. The interface also
has error states for unavailable images, an unavailable database, and an empty
query result.

## Strong Aspects of the Approach

### Appropriate technical simplicity

Deno, SQLite, and vanilla browser code are a good fit for a personal local
application. There is little installation or build machinery, and most of the
system can be understood by reading a small number of files.

The project should not be rewritten merely to introduce a framework. Its
current technology choices remain suitable.

### Focused backend modules

The backend has useful divisions of responsibility:

- Parameter handling is isolated from server routing.
- Filesystem scanning is isolated from database querying.
- Database operations are collected in one module.
- Logging behavior is centralized.

These boundaries are proportionate to the size of the program and make
incremental development practical.

### Staged deletion workflow

The strongest architectural decision is the separation between reviewing an
image and physically deleting it.

The workflow is broadly:

```text
review decision -> pending action -> dry run -> explicit execution
```

`scripts/executeDeletions.ts` defaults to a dry run. During execution it checks
that the file still exists and that the image has not subsequently received a
`keep` note. It then removes the file, moves the catalog row to `deleted`, and
records the action's result.

The restoration and replay procedure in `design/SS_Document.md` also shows
attention to recoverability and audit history.

### Useful operational behavior

Other good choices include:

- Parameterized SQL values for ordinary record operations.
- A transaction around moving catalog rows to `deleted`.
- Clear logging to the console and `slideshow.log`.
- Runtime log-level changes.
- Helpful error messages for missing media and invalid queries.
- A keyboard-oriented interface appropriate for reviewing many photographs.
- Shared CSS variables and reusable visual components.
- Small, incremental commits that show the application's evolution.

## Principal Safety Concern

At the time of review, `queryImages()` does more than query the database. It
also checks every selected file during server startup. If a file cannot be
found, it immediately moves the corresponding row from `fotos` to `deleted`.

This does not physically delete the photograph. Physical deletion only occurs
through the separately executed deletion script.

Nevertheless, ordinary startup can permanently alter the active catalog. A
file may appear missing because:

- An external drive is disconnected.
- A volume is mounted somewhere unexpected.
- A configured path differs between computers.
- Permissions or filesystem access fail temporarily.
- A file is temporarily unavailable during another operation.

These automatic catalog moves also do not create matching action-history rows,
which weakens the otherwise replayable deletion model.

The preferred replacement is documented in
`design/missing-file-reconciliation.md`. In summary, images should be checked
individually when requested, the library should be positively identified, and
one failed request should not be treated as confirmed deletion.

## Deletion Execution Concern

The deletion executor removes the physical file before moving the database row
from `fotos` to `deleted`. If the filesystem deletion succeeds and the database
operation subsequently fails, the photo is gone but the catalog transition is
incomplete.

A filesystem operation and SQLite transaction cannot be made truly atomic.
Potential future improvements include moving files to a quarantine or trash
directory before final removal, recording progress before each operation, and
making interrupted work safely resumable.

This concern should be addressed cautiously and independently from the
missing-file reconciliation work.

## Path Handling and Trust Boundaries

Some server paths are constructed through string concatenation. Static-file
and folder-mode image routes should eventually resolve requested paths to
canonical filesystem paths and verify that the result remains within the
configured root.

The control panel also accepts SQL `WHERE` and `ORDER BY` fragments. A keyword
and semicolon check blocks obvious modifications, but it is not a complete SQL
sandbox. This is acceptable only under the project's assumption that the user
and local browser are trusted.

Similarly, some error content is constructed with `innerHTML`. Configuration
or filesystem-derived values should preferably be inserted with `textContent`
or structured DOM operations.

These are meaningful correctness and safety improvements, but their urgency is
lower while the server is restricted to a trusted local environment.

## Configuration Observations

Configuration behavior has evolved and is not entirely consistent:

- `dbPath` is validated even when folder mode is selected.
- The settings endpoint writes submitted values to `params.json` without
  applying the same validation used at startup.
- Some documentation says `imageFolderPath` is prepended to database paths,
  while the current database contains and uses absolute paths.
- Some documentation still describes CSV note storage, although notes now go
  into SQLite.
- `orderBy` exists in the implementation but is not consistently documented.

The parameter system itself is straightforward. The main need is to make the
implementation, defaults, settings page, README, and contributor guidance
describe the same behavior.

## Frontend Organization

`static/app.js` is readable but has grown to manage many responsibilities:

- Slideshow timing and navigation.
- Image loading, preloading, retrying, and errors.
- Menu state and focus handling.
- Keyboard dispatch.
- Metadata fetching and display.
- Notes form state and submission.
- Dragging the notes panel.

The file also coordinates several booleans, including paused, menu open, form
open, startup error, image error, and information visibility. As features are
added, implicit combinations of these states may become difficult to reason
about.

A future cleanup could split the browser code into a few native ES modules,
such as slideshow, notes, overlays, and keyboard controls. This does not call
for a large framework. Refactoring should happen incrementally and preferably
after tests cover important behavior.

## Signs of Earlier Iterations

The repository contains several remnants or documentation mismatches from
earlier versions:

- `/api/actions` and `insertAction()` remain even though the current UI mainly
  records notes.
- The keyboard handler contains IDs for form fields that no longer exist.
- Some CSS classes appear to belong to removed action forms.
- `QueryResult` is imported but unused in `server.ts`.
- README and contributor guidance still mention CSV note storage.
- Contributor guidance describes database behavior and schema names that no
  longer match the implementation.

This is normal for a program developed through exploratory increments. A
focused consolidation pass would make future development easier without
changing the architecture.

## Testing and Maintenance

There is no configured automated test framework, type-check command, formatter,
linter, or continuous-integration workflow.

That was a reasonable early tradeoff for a small personal slideshow. The risk
profile is now higher because the application modifies a photo catalog and can
execute irreversible filesystem operations.

The highest-value tests would focus on behavior rather than broad coverage:

- Parameter validation.
- Safe path resolution.
- SQL-fragment rejection.
- Missing-file detection and recovery.
- Transaction rollback in `moveToDeleted()`.
- Notes and action insertion.
- Dry-run deletion behavior.
- Failure handling during deletion execution.

Tests involving destructive operations should use temporary image directories
and disposable databases, never the real collection.

## Overall Assessment

The project is pragmatic, understandable, and well matched to its owner's
incremental style of development. It has grown from a simple slideshow into a
useful photo-review workflow without accumulating unnecessary infrastructure.
The existing Deno, SQLite, and vanilla-JavaScript approach should be preserved.

The most important architectural principle already present is that destructive
work should be explicit, staged, reviewable, and recoverable. The principal
inconsistency is that missing files are currently reconciled automatically
during a read-like startup operation.

Future work should extend the careful staged philosophy to all catalog changes.
After safe missing-file handling, the most useful maintenance work would be:

1. Synchronize documentation with actual behavior.
2. Remove or clearly label obsolete functionality.
3. Add focused safety tests.
4. Improve path containment and error rendering.
5. Split the frontend into a few small modules if further growth makes that
   helpful.

These improvements can be made in small, understandable steps. A rewrite or
large up-front redesign is neither necessary nor recommended.
