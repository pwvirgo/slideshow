import { DatabaseSync } from "node:sqlite";
import { logger } from "./logger.ts";

export interface FotoRow {
  id: number;
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
  MD5: string | null;
}

// Image entry returned to the server — includes DB id for actions
export interface DbImage {
  id: number;
  fullPath: string;
  name: string;
}

const CREATE_ACTIONS_SQL = `
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  foto_id INTEGER NOT NULL,
  act TEXT,
  dt_act TEXT,
  note TEXT,
  FOREIGN KEY (foto_id) REFERENCES fotos(id)
)`;

// Reject anything that looks like it could modify the database
function validateWhereClause(clause: string): void {
  if (clause.trim() === "") return;
  const lower = clause.toLowerCase();
  const forbidden = ["insert", "update", "delete", "drop", "alter", "create", ";"];
  for (const word of forbidden) {
    if (lower.includes(word)) {
      throw new Error(`WHERE clause contains forbidden keyword: ${word}`);
    }
  }
}

export function openDb(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  // Ensure actions table exists
  db.exec(CREATE_ACTIONS_SQL);
  logger.info(`Opened database: ${dbPath}`);
  return db;
}

function fileExists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
}

export function queryImages(db: DatabaseSync, whereClause: string, maxFiles: number): DbImage[] {
  validateWhereClause(whereClause);

  const where = whereClause.trim() === "" ? "" : `WHERE ${whereClause}`;
  const sql = `SELECT id, path, name FROM fotos ${where} LIMIT ?`;

  logger.debug(`DB query: ${sql} [${maxFiles}]`);

  const stmt = db.prepare(sql);
  const rows = stmt.all(maxFiles) as FotoRow[];

  const allImages: DbImage[] = rows.map((row) => ({
    id: row.id,
    fullPath: `${row.path}/${row.name}`,
    name: row.name,
  }));

  // Filter out images whose files don't exist on disk
  const images = allImages.filter((img) => {
    const exists = fileExists(img.fullPath);
    if (!exists) {
      logger.debug(`Skipping missing file: ${img.fullPath}`);
    }
    return exists;
  });

  const skipped = allImages.length - images.length;
  if (skipped > 0) {
    logger.warn(`Skipped ${skipped} images with missing files (of ${allImages.length} from DB)`);
  }
  logger.info(`DB query returned ${images.length} available images`);
  return images;
}

export function insertAction(db: DatabaseSync, fotoId: number, act: string, note: string): void {
  const stmt = db.prepare(
    "INSERT INTO actions (foto_id, act, dt_act, note) VALUES (?, ?, datetime('now'), ?)"
  );
  stmt.run(fotoId, act, note);
  logger.info(`Action recorded: foto_id=${fotoId}, act=${act}`);
}
