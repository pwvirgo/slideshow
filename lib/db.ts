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
  skippedMissing: number;
  sampleSkippedPath: string | null;
}

export function queryImages(db: DatabaseSync, whereClause: string,
   maxFiles: number, orderBy = ""): QueryResult {

  validateSqlFragment(whereClause, "WHERE clause");
  validateSqlFragment(orderBy, "ORDER BY clause");

  const where = whereClause.trim() === "" ? "" : `WHERE ${whereClause}`;
  const order = orderBy.trim() === "" ? "" : `ORDER BY ${orderBy}`;
  const sql = `SELECT img_id, path, name FROM fotos ${where} ${order} LIMIT ?`;

  logger.debug(`DB query: ${sql} [${maxFiles}]`);

  const stmt = db.prepare(sql);
  const rows = stmt.all(maxFiles) as FotoRow[];

  const allImages: DbImage[] = rows.map((row) => ({
    id: row.img_id,
    fullPath: `${row.path}/${row.name}`,
    name: row.name,
  }));

  // Filter out images whose files don't exist on disk
  let sampleSkippedPath: string | null = null;
  const images = allImages.filter((img) => {
    const exists = fileExists(img.fullPath);
    if (!exists) {
      logger.debug(`Moving missing file to deleted table: ${img.fullPath}`);
      moveToDeleted(db, img.id);
      if (!sampleSkippedPath) sampleSkippedPath = img.fullPath;
    }
    return exists;
  });

  const skipped = allImages.length - images.length;
  if (skipped > 0) {
    logger.warn(`Moved ${skipped} images to deleted table (missing from disk, of ${allImages.length} from DB)`);
  }

  return {
    images,
    totalFromDb: allImages.length,
    skippedMissing: skipped,
    sampleSkippedPath,
  };
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
}

export function getImageInfo(db: DatabaseSync, fotoId: number): ImageInfo | null {
  const stmt = db.prepare(
    "SELECT img_id, path, name, dt_taken, dt_created, bytes, img_size, camera FROM fotos WHERE img_id = ?"
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
