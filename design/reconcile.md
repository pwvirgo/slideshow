# Missing-File Reconciliation

**Status:** design for a workflow that is **not yet built**. When it ships, fold
this into `SS_Document.md` as an operational section and delete this file.

Related docs: `README.md` → "Missing files (database mode)" describes the
detection behavior that already ships; `design/codex-project-review.md` is
historical architectural context.

## Background: detection (already implemented)

In database mode the server does **not** scan the filesystem at startup. Each
image's file is checked lazily, in `GET /api/imageInfo/<index>` (`server.ts`),
the moment before the frontend loads it:

- File present → served normally.
- File missing → the response carries `missing: true`; the frontend shows a
  brief **"Photo missing — skipped"** message for `displayTimeMs`, then
  advances. The first time a given image is found missing, one row is inserted
  into `notes`:
  `insertNote(db, imgId, 'missing', 5, 'File not found: <path>')`.
  `hasMissingNote()` prevents duplicate notes on later encounters.

Nothing in `fotos` is touched. `queryImages()` never checks the filesystem.

The database therefore accumulates `notes` rows with `category = 'missing'`.
Deciding whether each is a genuine deletion or a transient miss — and clearing
it — is the reconciliation workflow below.

## Reconciliation (to build)

A separate, owner-driven pass over pending `missing` notes. A person reviewing
the list is simpler and more reliable than a heuristic guessing at it.

### Inputs

Every `notes` row with `category = 'missing'`, joined to its `fotos` row,
oldest (`note_dt`) first. The `v_notes` view already provides that join
(`note_id, note_dt, category, rank, comment, img_id, status, path, name,
full_path, md5, bytes, img_size, camera, dt_taken, dt_created`):

```sql
SELECT * FROM v_notes WHERE category = 'missing' ORDER BY note_dt;
```

Re-check each file's existence at list time, so an image whose file has
reappeared is visibly distinct from one still missing.

### Per-row decision

For each `missing` note the owner sees the image identity (`img_id`, path,
`note_dt`, whether the file exists right now, any `keep` note) and picks one of
two outcomes — there is no "leave it flagged forever":

- **Correcting an error** — the file is actually there (unmounted drive,
  timing, wrong path at the time), or the owner otherwise knows it shouldn't be
  flagged. Resolve the note (see Open Questions: delete vs. recategorize). No
  other table changes.
- **Confirming the deletion** — the file is genuinely gone. Stage a pending
  delete: `insertAction(db, imgId, 'delete')` (`action='delete'`,
  `status='pending'` — both valid under the `actions` CHECK constraint).
  Resolve the `missing` note the same way. `actions` then owns what happens
  next. Do **not** touch the filesystem or the catalog here.

A `keep` note on the same `img_id` is worth surfacing as a hint, but the owner
still decides — the deletion executor independently skips `delete` actions on
images that have a `keep` note.

The photo-library marker (a check that the configured image root really is the
expected library) is useful context to show alongside each row — "the library
looks unavailable" is a good reason to pick "correcting an error" for a whole
batch — but it gates nothing; it is information, not a rule.

### After a run

- Some `missing` notes cleared as "correcting an error."
- Some resolved into staged `delete` actions.
- Some left untouched (not yet reviewed).

Executing the staged `delete` actions is the existing deletion workflow, run
separately and afterward.

## Dependency: the deletion executor needs the soft-delete migration first

`scripts/executeDeletions.ts` and `moveToDeleted()` in `lib/db.ts` still copy
rows into a `deleted` table and `DELETE` them from `fotos`. That table no
longer exists — the schema now uses `fotos.status` (`'ok'` / `'deleted'`).
Before reconciliation's staged `delete` actions can be executed, that code must
switch to a soft delete: `UPDATE fotos SET status = 'deleted' WHERE img_id = ?`
(and a decision on whether the file is also removed from disk or kept).
`queryImages()` already hides `status='deleted'` rows via its
`WITH fotos AS (SELECT * FROM main.fotos WHERE status='ok')` CTE.

## Open questions

- **Resolving a `missing` note:** delete the row, or recategorize it (e.g.
  `missing-corrected`) so the observation stays in the audit history but out of
  the `category='missing'` query? Pick one so the reconcile query and any
  future UI agree.
- **Review interface:** a script that lists rows and prompts per-row, or a
  batch file that is edited and re-run? (A web review screen is a later step.)
- **Confirmation strength:** is one owner decision enough, or should the file
  have to stay missing across an interval / a re-check first?
- **Photo-library marker:** filename and identifier convention, and where it
  lives.
- **Circuit breaker:** how many consecutive missing images should pause the
  slideshow with an alert instead of quietly skipping each one?
