// scripts/executeDeletions.ts
//
// Executes pending 'delete' rows staged in the `actions` table (see
// temp/action1.sql for how they were staged): deletes the file from disk,
// moves the fotos row into `deleted`, and marks the action 'done'.
//
// Dry-run by default — prints what it would do without touching anything.
// Pass --execute to actually delete files and update the database.
//
// Usage:
//   deno run --allow-read --allow-write scripts/executeDeletions.ts
//   deno run --allow-read --allow-write scripts/executeDeletions.ts --execute

import { loadParams } from "../lib/params.ts";
import { openDb, fileExists, moveToDeleted } from "../lib/db.ts";
import { logger } from "../lib/logger.ts";

interface PendingAction {
  action_id: number;
  img_id: number;
  path: string;
  name: string;
}

function hasKeepNote(db: ReturnType<typeof openDb>, imgId: number): boolean {
  const row = db.prepare(
    "SELECT 1 FROM notes WHERE img_id = ? AND LOWER(TRIM(category)) = 'keep' LIMIT 1"
  ).get(imgId);
  return row !== undefined;
}

async function main(): Promise<void> {
  const execute = Deno.args.includes("--execute");

  const params = await loadParams();
  logger.setLogLevel(params.logLevel);
  const db = openDb(params.dbPath);

  const pending = db.prepare(
    `SELECT a.action_id, a.img_id, f.path, f.name
     FROM actions a
     JOIN fotos f ON f.img_id = a.img_id
     WHERE a.action = 'delete' AND a.status = 'pending'`
  ).all() as unknown as PendingAction[];

  console.log(`${execute ? "EXECUTING" : "DRY RUN"} — ${pending.length} pending delete action(s) found.\n`);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of pending) {
    const fullPath = `${row.path}/${row.name}`;

    // Re-verify safety at execution time — state may have changed since staging.
    if (!fileExists(fullPath)) {
      skipped++;
      console.log(`SKIP  action_id=${row.action_id} img_id=${row.img_id} — file already missing: ${fullPath}`);
      if (execute) {
        db.prepare("UPDATE actions SET status = 'failed', status_dt = datetime('now') WHERE action_id = ?")
          .run(row.action_id);
      }
      continue;
    }
    if (hasKeepNote(db, row.img_id)) {
      skipped++;
      console.log(`SKIP  action_id=${row.action_id} img_id=${row.img_id} — now has a 'keep' note: ${fullPath}`);
      if (execute) {
        db.prepare("UPDATE actions SET status = 'failed', status_dt = datetime('now') WHERE action_id = ?")
          .run(row.action_id);
      }
      continue;
    }

    if (!execute) {
      console.log(`WOULD DELETE  action_id=${row.action_id} img_id=${row.img_id} — ${fullPath}`);
      continue;
    }

    try {
      await Deno.remove(fullPath);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to remove file for img_id=${row.img_id}: ${message}`);
      db.prepare("UPDATE actions SET status = 'failed', status_dt = datetime('now') WHERE action_id = ?")
        .run(row.action_id);
      continue;
    }

    if (!moveToDeleted(db, row.img_id)) {
      failed++;
      db.prepare("UPDATE actions SET status = 'failed', status_dt = datetime('now') WHERE action_id = ?")
        .run(row.action_id);
      continue;
    }

    db.prepare("UPDATE actions SET status = 'done', status_dt = datetime('now') WHERE action_id = ?")
      .run(row.action_id);
    done++;
    logger.info(`Deleted img_id=${row.img_id}: ${fullPath}`);
  }

  console.log(`\nDone: ${done}  Skipped: ${skipped}  Failed: ${failed}`);
  if (!execute) {
    console.log(`\nThis was a dry run — no files or database rows were changed. Re-run with --execute to apply.`);
  }
}

main();
