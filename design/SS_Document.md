# SlideShow Documentation

## the slideshow app has a useful slideshow.log!

## use the slideshow to create notes in the notes table
1.  pause the slideshow  by pressing the space bar to toggle pause mode
2.  Create a note  by pressing N or n key

## Create/add delete pending rows in the actions table from the notes table
Notes with `category = 'delete'` mark an image for deletion but don't by
themselves create an `actions` row — that has to be staged separately. This
inserts a pending `delete` action for every `notes` row marked for deletion,
skipping any `img_id` that already has a `delete` row in `actions` (of any
status) to avoid duplicates:

```sql
INSERT INTO actions (action, img_id, status)
SELECT 'delete', n.img_id, 'pending'
FROM notes n
WHERE n.category = 'delete'
  AND n.img_id NOT IN (
    SELECT img_id FROM actions WHERE action = 'delete'
  );
```

Check what would be inserted before running it for real:

```sql
SELECT n.img_id, n.category, n.comment
FROM notes n
WHERE n.category = 'delete'
  AND n.img_id NOT IN (
    SELECT img_id FROM actions WHERE action = 'delete'
  );
```
If all were moved to the action table you might delete those row from the notes table.
## Executing pending deletions

This is the normal, day-to-day process for turning staged `delete` actions
into actual file deletions: any row in the `actions` table with
`action='delete'` and `status='pending'` gets its file removed from disk,
its `fotos` row moved into `deleted`, and its `actions` row marked `done`.
Rows get staged as pending in a few ways — clicking delete in the Notes UI
in `static/app.js`, or an ad-hoc SQL `INSERT` like `temp/action_request.sql`
for a bulk curation pass.

`scripts/executeDeletions.ts` does the actual work, and re-verifies safety
at execution time (not just at staging time):
- Skips (and marks `failed`) any row whose file has since gone missing.
- Skips (and marks `failed`) any row whose image has since gotten a
  `'keep'`-category note added in `notes`.

### Steps

1. **Check what's pending**, and sanity-check that the count looks right for
   what you staged:
   ```sql
   SELECT COUNT(*), action, status
   FROM actions
   group by action,status
   order by action,status
   ```

2. **Dry run** — prints what would happen without touching anything:
   ```bash
   deno run --allow-read --allow-write scripts/executeDeletions.ts
   ```
   Review the list. Confirm the count and a sample of the paths look right.

3. **Live-test one row** before committing to the full batch. There's no
   built-in single-row flag, so either:
   - Temporarily set every pending row's `status` to something other than
     `pending` (e.g. `'failed'`) except the one you want to test, run
     `--execute`, then set the rest back to `pending`;
      or
   
   - Write a small throwaway script (see `temp/` for past examples) that
     imports `openDb`, `fileExists`, and `moveToDeleted` from `lib/db.ts`
     and performs the same steps on one specific `action_id`.

   After the test, confirm all of the following:
   - The file is actually gone from disk.
   - The row exists in `deleted`.
   - The row no longer exists in `fotos`.
   - The `actions` row's `status` is `done`.

4. **Run the full batch for real:**
   ```bash
   deno run --allow-read --allow-write scripts/executeDeletions.ts --execute
   ```
   Check the summary line (`Done / Skipped / Failed`) — `Failed` should be
   `0`; investigate before re-running if it isn't.

5. **Verify the final state:**
   ```sql
   SELECT
     (SELECT COUNT(*) FROM actions WHERE action='delete' AND status='pending') AS still_pending,
     (SELECT COUNT(*) FROM actions WHERE action='delete' AND status='failed')  AS failed,
     (SELECT COUNT(*) FROM fotos)   AS fotos,
     (SELECT COUNT(*) FROM deleted) AS deleted;
   ```
   `still_pending` and `failed` should both be `0` once everything has gone
   through cleanly.
## Restoring the database and images

This procedure restores `fotos.db` and the images folder to a known-good
state, then replays the full curation history recorded in the `actions`
table to deterministically recreate the current state. Use it if there's
ever doubt about the correctness of a curation batch.

It relies on two things that already exist:
- `unedited` — a table in `photos.db` holding the original, untouched
  `fotos` table (same schema), from before any curation deletions.
- `actions` — every curation decision ever made is recorded here as a row
  (`action='delete'`, `status='done'` once applied). This is the full
  history that gets replayed.

### Prerequisites

- A complete backup of the images folder (all files, including ones
  since deleted) available to restore using the ../photos project (see ../photos/README.md)
- Before wiping `deleted`, confirm every row in it has a matching row in
  `actions`. `queryImages()` in `lib/db.ts` can auto-move a row from
  `fotos` to `deleted` when it finds the file missing on disk, without
  creating an `actions` row — if that happened, the affected `img_id`s
  won't be reproduced by the replay and need to be handled separately
  (e.g. re-add a matching `actions` row, or accept they'll come back into
  `fotos` after restore).
  ```sql
  SELECT * FROM deleted d WHERE NOT EXISTS (
    SELECT 1 FROM actions a WHERE a.img_id = d.img_id
  );
  ```

### Steps

1. **Restore the images folder** to its complete, pristine state (all
   files present, including any since deleted).

2. **Restore the `fotos` table from `unedited`:**
   ```sql
   DELETE FROM fotos;
   INSERT INTO fotos SELECT * FROM unedited;
   ```

3. **Clear the `deleted` table** — it will be regenerated by the replay:
   ```sql
   DELETE FROM deleted;
   ```

4. **Reset all actions to pending:**
   ```sql
   UPDATE actions SET status = 'pending', status_dt = NULL;
   ```

5. **Replay the actions.** First dry-run, then execute for real:
   ```bash
   deno run --allow-read --allow-write scripts/executeDeletions.ts
   deno run --allow-read --allow-write scripts/executeDeletions.ts --execute
   ```
   This re-deletes each file recorded in `actions` and moves its `fotos`
   row into `deleted`, recreating the current state from scratch.

### Verification

After replay, confirm the counts match the pre-restore state:
```sql
SELECT
  (SELECT COUNT(*) FROM fotos)    AS fotos,
  (SELECT COUNT(*) FROM deleted)  AS deleted,
  (SELECT COUNT(*) FROM unedited) AS unedited,
  (SELECT COUNT(*) FROM actions WHERE action='delete' AND status='done') AS done_deletes;
```
`fotos + deleted` should equal `unedited`, and `done_deletes` should equal
`deleted`'s row count.

Before running the full replay against real data, test it live on a single
row first (temporarily filter `executeDeletions.ts`'s query to one
`action_id`, or verify the first row it processes) to catch any schema or
environment drift before committing to the full batch.
