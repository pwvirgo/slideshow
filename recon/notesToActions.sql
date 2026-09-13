-- recon/notesToActions.sql
--
-- Stage pending 'delete' actions from notes with category 'delete'.
-- Run AFTER recon/executeDeletions.ts has cleared the existing pending actions:
--   sqlite3 ../photos/photos3.db < recon/notesToActions.sql
--
-- - One action per img_id, however many delete notes it has.
-- - Skips images that already have a delete action (any status).
-- - info = 'delete: notes <note_ids> — <comments>'.
-- - 'missing' notes are ignored; notes rows are left as they are.

.bail on
BEGIN;

-- Refuse to run while pending actions remain (CHECK fails -> .bail rolls back).
CREATE TEMP TABLE guard (pending INTEGER CHECK (pending = 0));
INSERT INTO guard SELECT COUNT(*) FROM actions WHERE status = 'pending';

CREATE TEMP TABLE staged AS
SELECT s.img_id,
       s.note_ids,
       s.comments,
       f.path || '/' || f.name AS full_path,
       CASE
         WHEN f.img_id IS NULL THEN 'no fotos row'
         WHEN EXISTS (SELECT 1 FROM actions a WHERE a.img_id = s.img_id AND a.action = 'delete')
           THEN 'already has a delete action'
       END AS skip_reason
FROM (
  SELECT img_id,
         GROUP_CONCAT(note_id) AS note_ids,
         GROUP_CONCAT(NULLIF(TRIM(comment), ''), ' | ') AS comments
  FROM notes
  WHERE LOWER(TRIM(category)) = 'delete'
  GROUP BY img_id
) s
LEFT JOIN fotos f ON f.img_id = s.img_id;

SELECT 'SKIPPED' AS result, img_id, skip_reason, full_path
FROM staged WHERE skip_reason IS NOT NULL;

INSERT INTO actions (action, info, request_dt, status_dt, status, img_id)
SELECT 'delete',
       'delete: notes ' || note_ids || COALESCE(' — ' || comments, ''),
       datetime('now'),
       datetime('now'),
       'pending',
       img_id
FROM staged
WHERE skip_reason IS NULL;

SELECT 'STAGED' AS result, changes() AS actions_inserted;

COMMIT;
