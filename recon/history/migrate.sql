-- Migrate the `actions` history from the pre-rebuild backup db (photos2.db)
-- into the empty `actions` table of the rebuilt db (photos3.db).
--
-- Run from sqlite3 with the CWD at the slideshow project root:
--   sqlite3 ../photos/backup/photos2.db < recon/history/migrate.sql
--
-- All 850 rows in the backup's `actions` table have action='delete'. Their
-- img_id values point into the OLD db's numbering, which is meaningless in
-- photos3 (it was rebuilt from disk with fresh img_ids), so every row must be
-- re-matched to its photos3.fotos.img_id via (path, name, md5) rather than
-- copied by id. Two sources of old rows, both under the old `images/` tree:
--   - 849 rows: the source image was already moved to the old `deleted` table
--     when the action was recorded (status done/failed).
--   - 1 row: img_id 6962, status='pending' — the delete was queued but never
--     executed, so the source row is still in the old `fotos` table, not
--     `deleted`.
-- Checked interactively: both sets match 1:1 against photos3.fotos with no
-- unmatched rows and no duplicate matches (path swapped images->images3,
-- plus name and md5 as belt-and-braces).
--
-- `info` is repurposed to record migration provenance since the old
-- action_id/img_id have no meaning in photos3: 'round1:<old action_id>'.
--
-- Verified against disk: the files behind these old 'done' delete actions
-- are all still present under ../photos/images3 — the physical delete was
-- never re-executed against the rebuilt tree. So every migrated row is
-- reset to status='pending' (dropping the old done/failed/pending status),
-- with status_dt set equal to request_dt rather than carried over from the
-- old row, so the real deletion script can pick these up fresh.

ATTACH '../photos/photos3.db' AS photos3;

INSERT INTO photos3.actions (action, info, request_dt, status_dt, status, img_id)
SELECT a.action,
       'round1:' || a.action_id,
       a.request_dt,
       a.request_dt,
       'pending',
       f.img_id
FROM actions a
JOIN deleted d ON d.img_id = a.img_id
JOIN photos3.fotos f
  ON f.path = REPLACE(d.path, '/images/', '/images3/')
 AND f.name = d.name
 AND f.md5  = d.md5

UNION ALL

SELECT a.action,
       'round1:' || a.action_id,
       a.request_dt,
       a.request_dt,
       'pending',
       f.img_id
FROM actions a
JOIN fotos old_f ON old_f.img_id = a.img_id
JOIN photos3.fotos f
  ON f.path = REPLACE(old_f.path, '/images/', '/images3/')
 AND f.name = old_f.name
 AND f.md5  = old_f.md5
WHERE a.img_id NOT IN (SELECT img_id FROM deleted);

DETACH photos3;
