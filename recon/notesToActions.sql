-- recon/notesToActions.sql
--
-- Stage pending 'delete' actions from notes with category 'delete'.
-- Run AFTER recon/executeDeletions.ts has cleared the existing pending actions:
--   sqlite3 ../photos/photos3.db < recon/notesToActions.sql
--
-- - One action per img_id, however many delete notes it has.
-- - Skips images that already have a delete action (any status).
-- - info = the note's comment, nothing else (' | '-joined if an image has
--   several delete notes; NULL if none of them carried a comment).
-- - 'missing' notes are ignored; notes rows are left as they are.
-- - Results are shown on screen and appended to recon/recon.log (relative to
--   the project root, so run from there). Errors go to the screen only, unless
--   you add `2>> recon/recon.log` to the command line.

.bail on

.output |tee -a recon/recon.log
.print ''
.print '=== recon/notesToActions.sql ==='
SELECT datetime('now','localtime') AS run_at;

BEGIN;

-- Refuse to run while pending actions remain (CHECK fails -> .bail rolls back).
CREATE TEMP TABLE guard (pending INTEGER CHECK (pending = 0));
INSERT INTO guard SELECT COUNT(*) FROM actions WHERE status = 'pending';

CREATE TEMP TABLE staged AS
SELECT s.img_id,
       s.comments,
       f.path || '/' || f.name AS full_path,
       CASE
         WHEN f.img_id IS NULL THEN 'no fotos row'
         WHEN EXISTS (SELECT 1 FROM actions a WHERE a.img_id = s.img_id AND a.action = 'delete')
           THEN 'already has a delete action'
       END AS skip_reason
FROM (
  SELECT img_id,
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
       comments,          -- the note's comment verbatim; no prefix, no note ids
       datetime('now'),
       datetime('now'),
       'pending',
       img_id
FROM staged
WHERE skip_reason IS NULL;

SELECT 'STAGED' AS result, changes() AS actions_inserted;

COMMIT;

.output stdout
