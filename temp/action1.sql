-- action1.sql
--
-- Why: Stage confirmed-safe-to-delete images into the `actions` table
-- (status='pending') instead of deleting files immediately, so a mistake
-- doesn't require redoing the manual duplicate review. `deleted` is reserved
-- for files already confirmed gone from disk (see lib/db.ts moveToDeleted()),
-- so `actions` is used here as the staging/audit point instead.
--
-- When: 2026-08-19, run once against /Users/mac24/a/projects/photos/photos.db.
-- Record of what was run, not a rerunnable script: rerunning as-is would
-- create duplicate `actions` rows (no guard against already-staged img_id).
--
-- Result: 260 rows inserted (259 from Rule 1, 1 from Rule 2, no overlap).

-- Rule 1: images in .../macbook2012/Dropbox/Camera Uploads/ that have a
-- byte-identical (md5) copy elsewhere in fotos, excluding anything the user
-- already flagged 'keep' in notes.category.
INSERT INTO actions (action, img_id, status)
SELECT 'delete', a.img_id, 'pending'
FROM fotos a
WHERE a.path LIKE '%macbook2012/Dropbox/Camera Uploads%'
  AND EXISTS (
    SELECT 1 FROM fotos b
    WHERE b.md5 = a.md5
      AND b.img_id != a.img_id
      AND b.path NOT LIKE '%macbook2012/Dropbox/Camera Uploads%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM notes n
    WHERE n.img_id = a.img_id AND LOWER(TRIM(n.category)) = 'keep'
  );

-- Rule 2: any image (any location) the user flagged 'delete' in
-- notes.category, still present in fotos.
INSERT INTO actions (action, img_id, status)
SELECT DISTINCT 'delete', n.img_id, 'pending'
FROM notes n
WHERE LOWER(TRIM(n.category)) = 'delete'
  AND EXISTS (SELECT 1 FROM fotos f WHERE f.img_id = n.img_id);

-- 2026-08-21 delete photos from google drive which are all dups to of
-- pwv inventory
sqlite> select count(*), action, status
   ...> from actions
   ...> group by action,status
   ...> order by action,status;
count(*)  action  status
--------  ------  ------
684       delete  done 
-- 

INSERT INTO actions (action, img_id, status)
SELECT DISTINCT 'delete', f.img_id, 'pending'
-- select count(*) 
FROM fotos f
WHERE f.path LIKE '%googleDrive%' and f.name LIKE '%.jpg%';

sqlite> select count(*), action, status
   ...> from actions
   ...> group by action,status
   ...> order by action,status
   ...> ;
count(*)  action  status 
--------  ------  -------
684       delete  done   
78        delete  pending
