# SlideShow Documentation

## the slideshow app has a useful slideshow.log!

## use the slideshow to create notes in the notes table
1.  pause the slideshow  by pressing the space bar to toggle pause mode
2.  Create a note  by pressing N or n key

## Curation workflow

Deleting images is a run-by-hand process, always in this order:

1. **Execute** any pending `delete` actions — `recon/executeDeletions.ts`.
2. **Stage** new deletes from `delete` notes — `recon/notesToActions.sql`.
3. Review in the slideshow, add more `delete` notes, and repeat.

`notesToActions.sql` refuses to run while any action is still pending, so
step 1 always comes first. `missing` notes are not part of this workflow.

## Executing pending deletions

For every `actions` row with `action='delete'` and `status='pending'`:

- **Duplicates** — if an image has more than one pending delete, the extras
  are deleted from `actions` first (the lowest `action_id` is kept).
- **File present** — moved to `../photos/trash/<img_id>_<name>`, then in one
  transaction `fotos.status='deleted'` and the action `done`. If that
  transaction fails the file is moved back.
- **File already gone** — `fotos.status='deleted'`, action `failed` with
  `file gone` appended to `info`.
- **File already in trash** (an earlier run was interrupted after the move) —
  just finishes the database update.
- **Folder not found** (volume disconnected?) — skipped, nothing changed.
- **File in both places** — reported, left untouched.

Files are never removed outright; emptying `../photos/trash` is a separate,
manual step once you're happy with the result.

### Steps

1. **Check what's pending:**
   ```sql
   SELECT action, status, COUNT(*) FROM actions GROUP BY action, status;
   ```

2. **Dry run** — prints what would happen without touching anything:
   ```bash
   deno run --allow-read --allow-write recon/executeDeletions.ts
   ```
   Confirm the counts and a sample of the paths look right.

3. **Live-test one image:**
   ```bash
   deno run --allow-read --allow-write recon/executeDeletions.ts --execute --limit 1
   ```
   Confirm the file is in `../photos/trash`, `fotos.status` is `deleted`, and
   the action is `done`.

4. **Run the full batch:**
   ```bash
   deno run --allow-read --allow-write recon/executeDeletions.ts --execute
   ```
   Check the summary line (`Moved / Resumed / File gone / Failed / Skipped`).
   Re-running is safe; it only picks up what is still pending.

5. **Verify:**
   ```sql
   SELECT
     (SELECT COUNT(*) FROM actions WHERE action='delete' AND status='pending') AS still_pending,
     (SELECT COUNT(*) FROM actions WHERE action='delete' AND status='failed')  AS failed,
     (SELECT COUNT(*) FROM fotos WHERE status='deleted') AS deleted;
   ```
   Review any `failed` rows: `SELECT * FROM actions WHERE status='failed';`

## Staging deletes from notes

Turns `notes` rows with `category='delete'` into pending actions:

```bash
sqlite3 ../photos/photos3.db < recon/notesToActions.sql
```

- One action per image, however many `delete` notes it has.
- `info` = `delete: notes <note_ids> — <comments>`.
- Images that already have a `delete` action (any status) are skipped and listed.
- Notes rows are left in place; prune them by hand if you like.

## Undoing a deletion

Until the trash is emptied, a deletion can be reversed by hand:

```bash
mv "../photos/trash/<img_id>_<name>" "<fotos.path>/<name>"
```
```sql
UPDATE fotos   SET status = 'ok' WHERE img_id = <img_id>;
UPDATE actions SET status = 'failed', status_dt = datetime('now'),
       info = COALESCE(info || ' | ', '') || 'undone'
 WHERE img_id = <img_id> AND action = 'delete' AND status = 'done';
```

## Rebuilding the database

`fotos` is owned by the `../photos` project. If it is rebuilt, `img_id`s
change and old `actions` rows no longer point at the right images. They must
be re-matched by `path` + `name` + `md5` and set back to `pending`, then
re-executed as above. `recon/history/migrate.sql` is the worked example
(photos2.db → photos3.db).
