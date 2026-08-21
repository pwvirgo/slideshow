-- Insert select rows in actions table as pending 'delete' actions
INSERT INTO actions (action, img_id, status)
SELECT 'delete', img_id, 'pending'
FROM fotos
WHERE path LIKE '%macbook2012/Dropbox/Camera Uploads%'
  AND NOT EXISTS (
    SELECT 1 FROM fotos b WHERE b.md5 = fotos.md5 AND b.img_id != fotos.img_id
  )
  AND img_id NOT IN (SELECT img_id FROM notes)
  AND img_id NOT IN (SELECT img_id FROM actions WHERE action = 'delete');
