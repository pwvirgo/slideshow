# Missing-File Reconciliation

## Purpose

The slideshow uses a SQLite database as a catalog of photographs. Photographs
and entire folders may also be deleted, moved, or renamed outside the
slideshow application.

The application should notice these changes with little or no maintenance by
the user. At the same time, a disconnected drive, incorrect path, temporary
filesystem problem, or other glitch must not cause valid photographs to be
treated as intentionally deleted.

This document records the intended behavior. It is a design proposal, not a
description of functionality that has already been implemented.

## Current Behavior and Risk

At server startup, `queryImages()` loads database rows and checks whether every
selected file exists. If a file cannot be found, its row is immediately moved
from `fotos` to `deleted`.

This does not delete the photograph from the filesystem. Actual file deletion
is performed separately by `scripts/executeDeletions.ts` and only for staged
delete actions.

However, startup reconciliation can still alter the catalog when a photograph
is only temporarily unavailable. It also makes application startup a batch
operation with database side effects.

## Desired User Experience

Missing files should be detected one image at a time, when the slideshow tries
to display them. This lets the user change files outside the application and
see the result while reviewing photographs.

The guiding rule is:

> Do not inspect or alter an image's catalog state until that image is
> requested.

Starting the server should query the ordered list of database images, but it
should not check every file and should not move any rows to `deleted`.

## Photo-Library Marker

A marker is a small file placed in the root of the expected photo library. For
example:

```text
/path/to/photos/images/.photos-library
```

Its contents identify the library, for example:

```text
photo-library-id: mac24-main-library
```

Before treating a requested image as genuinely missing, the application
checks that:

1. The configured library root exists and is readable.
2. The marker file exists at that root.
3. The marker contains the expected library identifier.

The marker is an identity card for the library. It helps distinguish a missing
photograph from a disconnected drive, incorrect configuration, empty mount
point, or different volume mounted at a similar path.

The marker does not prove that every photograph is safe, and it does not
protect against files accidentally deleted outside the application. Backups
remain necessary for that protection.

The location of the library root, marker name, marker identifier, and whether
one marker can cover all database paths must be decided before implementation.

## Proposed Image-Request Flow

When the browser requests a database-backed image:

1. The server looks up the selected database record.
2. The server checks that particular file.
3. If it exists, the server serves it normally and clears any previous missing
   observation for that image.
4. If it does not exist, the server validates the photo-library marker.
5. If the marker cannot be validated, the server treats the library as
   unavailable. It reports the problem and makes no catalog change.
6. If the marker is valid, the server records a missing observation for the
   requested image.
7. The browser shows a brief message, removes the image from its current
   in-memory slideshow list, and advances to the next image.

Example feedback:

```text
Photo missing -- skipped
IMG_ID 4172
/Photos/Family/example.jpg
```

Removing the image from the browser's current list prevents the slideshow from
encountering the same missing image every time it wraps around.

## Confirming That a File Is Missing

A single failed request should not immediately move the database row.

On the first healthy-library failure, the application records one missing
observation. If the same image is requested again later and is still missing
while the marker is valid, the application records a second observation and
may then move the row from `fotos` to `deleted`.

The observations should be separated by a minimum interval, such as 30
seconds. This prevents multiple browser requests made during one loading
attempt from counting as independent confirmation.

If the file becomes available again, its missing observation is removed.

A possible table is:

```sql
CREATE TABLE missing_files (
    img_id INTEGER PRIMARY KEY,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    healthy_scan_count INTEGER NOT NULL DEFAULT 1,
    path TEXT NOT NULL
);
```

The final table name, columns, confirmation interval, and number of required
observations are implementation decisions, not settled requirements.

## Protection Against Larger Failures

Image-by-image processing still needs protection against a missing folder,
partial mount, or widespread storage problem.

The server should count consecutive missing requested images. If a small
threshold is reached, such as five consecutive images, it should stop automatic
reconciliation and report that the library or a folder may be unavailable.
No further rows should be moved until the condition is resolved or explicitly
reviewed.

A successfully served image resets the consecutive-missing count.

The appropriate threshold and recovery behavior should be chosen during
implementation.

## Catalog Reconciliation Is Not File Deletion

This workflow handles files that have already disappeared outside the
application. It should only reconcile the database catalog:

```text
fotos -> deleted
```

It must not create a delete action or attempt to delete a physical file. The
existing staged deletion workflow remains separate:

```text
review decision -> pending action -> dry run -> explicit execution
```

Keeping these responsibilities separate preserves the audit trail and avoids
confusing an absent file with a request to delete a file.

## External Additions

Lazy checking detects deletion, movement, or renaming of images already in the
slideshow's database list. It does not discover database rows added after that
list was loaded.

A future `Refresh images` command could requery the database without restarting
the server. This is useful but is not required for the first implementation of
safe missing-file reconciliation.

## Suggested Code Responsibilities

The implementation should keep each operation narrow and understandable:

- `queryImages()` queries database records only. It does not check the
  filesystem or mutate catalog state.
- The image-serving route checks the one requested image.
- A small function validates the library marker.
- A small function records or clears missing observations.
- A small function moves a persistently missing row from `fotos` to `deleted`.
- The frontend handles a missing-image response by notifying the user,
  removing that image from the current slideshow, and advancing safely.

The project should retain its current Deno, SQLite, and vanilla-JavaScript
approach. This feature does not require a framework or a large redesign.

## Implementation Sequence

A small-step implementation could proceed as follows:

1. Remove filesystem checks and database mutation from `queryImages()`.
2. Check file availability only in the database-mode image-serving route.
3. Make the frontend skip a requested image that is missing.
4. Add and validate the library marker, with no database reconciliation yet.
5. Add persistent missing observations and clear them when files reappear.
6. Move a row to `deleted` only after the configured confirmation rule passes.
7. Add the consecutive-missing circuit breaker.
8. Add focused tests for marker failure, transient absence, reappearance,
   confirmed absence, and multiple consecutive missing images.

Each step should be tested and understood before proceeding to the next.

## Questions to Resolve Before Coding

- What common directory should be considered the root of the photo library?
- Do all database image paths belong to that one library?
- What marker filename and library identifier should be used?
- Should confirmation require two observations, two server runs, elapsed time,
  or a combination?
- How long should the minimum confirmation interval be?
- How many consecutive missing images should trigger the circuit breaker?
- Once the circuit breaker triggers, should a valid image automatically reset
  it, or should the user explicitly acknowledge it?
- Should confirmed catalog moves happen automatically or be shown in a small
  review screen first?

These choices can be made incrementally. The essential safety requirements are
that an unavailable library causes no catalog mutation and that one failed file
request is not treated as confirmed deletion.
