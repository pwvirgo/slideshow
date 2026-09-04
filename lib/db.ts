import { DatabaseSync } from "node:sqlite";
import { logger } from "./logger.ts";

export interface FotoRow {
  img_id: number;
  path: string;
  name: string;
  bytes: number;
  dt_taken: string | null;
  dt_created: string | null;
  camera: string | null;
  lens: string | null;
  lat: number | null;
  lon: number | null;
  img_size: string | null;
  duration: string | null;
  md5: string | null;
}

// Image entry returned to the server — includes DB id for actions
export interface DbImage {
  id: number;
  fullPath: string;
  name: string;
}

// Reject anything that looks like it could modify the database
function validateSqlFragment(clause: string, label: string): void {
  if (clause.trim() === "") return;
  if (clause.includes(";")) {
    throw new Error(`${label} contains forbidden keyword: ;`);
  }
  const forbidden = ["insert", "update", "delete", "drop", "alter", "create"];
  for (const word of forbidden) {
    if (new RegExp(`\\b${word}\\b`, "i").test(clause)) {
      throw new Error(`${label} contains forbidden keyword: ${word}`);
    }
  }
}

export function openDb(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  // node:sqlite enforces foreign keys by default (unlike the sqlite3 CLI, which
  // is off by default). actions/notes intentionally keep img_id referencing
  // fotos rows that later get moved to `deleted` as an audit trail, so FK
  // enforcement here would block that by design — keep it off to match the
  // behavior this app was designed and tested against.
  db.exec("PRAGMA foreign_keys = OFF;");
  logger.info(`Opened database: ${dbPath}`);
  return db;
}

export function fileExists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
}

// Copy a fotos row into the deleted table and remove it from fotos.
// Assumes `deleted` has the same columns as `fotos` (owned/created externally).
export function moveToDeleted(db: DatabaseSync, imgId: number): boolean {
  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO deleted SELECT * FROM fotos WHERE img_id = ?").run(imgId);
    db.prepare("DELETE FROM fotos WHERE img_id = ?").run(imgId);
    db.exec("COMMIT");
    return true;
  } catch (err) {
    db.exec("ROLLBACK");
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to move img_id=${imgId} to deleted table: ${message}`);
    return false;
  }
}

export interface QueryResult {
  images: DbImage[];
  totalFromDb: number;
}

// Queries the fotos table only — does not touch the filesystem or mutate
// catalog state. Missing-file detection happens lazily, per image, when it's
// actually requested for display (see server.ts /api/imageInfo and /images
// routes), not here at query/startup time. See design/missing_files.md.
export function queryImages(db: DatabaseSync, whereClause: string,
   maxFiles: number, orderBy = ""): QueryResult {

  validateSqlFragment(whereClause, "WHERE clause");
  validateSqlFragment(orderBy, "ORDER BY clause");

  // `status='deleted'` rows are soft-deleted: the app treats them as if they
  // were gone from the table (this replaced an older scheme that physically
  // moved rows into a separate `deleted` table). A CTE named `fotos` shadows
  // the real table for the entire query, so the params.json whereClause — and
  // any self-reference it makes, e.g. a correlated `FROM fotos b` for md5
  // dedup — only ever sees live rows, and needs no `status` filter of its own.
  const where = whereClause.trim() === "" ? "" : `WHERE ${whereClause}`;
  const order = orderBy.trim() === "" ? "" : `ORDER BY ${orderBy}`;
  const sql =
    `WITH fotos AS (SELECT * FROM main.fotos WHERE status = 'ok') ` +
    `SELECT img_id, path, name FROM fotos ${where} ${order} LIMIT ?`;

  logger.debug(`DB query: ${sql} [${maxFiles}]`);

  const stmt = db.prepare(sql);
  const rows = stmt.all(maxFiles) as FotoRow[];

  const images: DbImage[] = rows.map((row) => ({
    id: row.img_id,
    fullPath: `${row.path}/${row.name}`,
    name: row.name,
  }));

  return { images, totalFromDb: images.length };
}

export interface ImageInfo {
  id: number;
  name: string;
  path: string;
  dtTaken: string | null;
  dtCreated: string | null;
  bytes: number | null;
  imgSize: string | null;
  camera: string | null;
  md5: string | null;
}

export function getImageInfo(db: DatabaseSync, fotoId: number): ImageInfo | null {
  const stmt = db.prepare(
    "SELECT img_id, path, name, dt_taken, dt_created, bytes, img_size, camera, MD5 AS md5 FROM fotos WHERE img_id = ?"
  );
  const row = stmt.get(fotoId) as FotoRow | undefined;
  if (!row) return null;

  return {
    id: row.img_id,
    name: row.name,
    path: `${row.path}/${row.name}`,
    dtTaken: row.dt_taken || null,
    dtCreated: row.dt_created || null,
    bytes: row.bytes ?? null,
    imgSize: row.img_size || null,
    camera: row.camera || null,
    md5: row.md5 || null,
  };
}

export function insertAction(db: DatabaseSync, imgId: number, action: string, path?: string): void {
  const stmt = db.prepare(
    "INSERT INTO actions (action, img_id, status) VALUES (?, ?, 'pending')"
  );
  stmt.run(action, imgId);
  const actionUpper = action.toUpperCase();
  const pathInfo = path ? `path=${path}` : '';
  logger.info(`Action ${actionUpper}, img_id=${imgId}, ${pathInfo}`);
}

export function insertNote(
  db: DatabaseSync,
  imgId: number,
  category: string | null,
  rank: number | null,
  comment: string | null,
): void {
  const stmt = db.prepare(
    "INSERT INTO notes (category, rank, comment, img_id) VALUES (?, ?, ?, ?)"
  );
  stmt.run(category, rank, comment, imgId);
  logger.info(`Note saved, img_id=${imgId}, category=${category ?? ""}, rank=${rank ?? ""}`);
}

// True if a 'missing' note already exists for this image — used so a
// still-missing file doesn't get a fresh note on every request. See
// design/missing_files.md.
export function hasMissingNote(db: DatabaseSync, imgId: number): boolean {
  const row = db.prepare(
    "SELECT 1 FROM notes WHERE img_id = ? AND LOWER(TRIM(category)) = 'missing' LIMIT 1"
  ).get(imgId);
  return row !== undefined;
}
