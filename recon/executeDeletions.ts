// recon/executeDeletions.ts
//
// Executes pending 'delete' actions. First removes duplicate pending delete
// actions (keeps the lowest action_id per image). Then for each image: move
// the file into <db folder>/trash/<img_id>_<name>, and in ONE transaction set
// fotos.status='deleted' and the action to 'done'. If the file is already
// gone: fotos.status='deleted', action 'failed' with 'file gone' in info.
// Emptying the trash is a separate, manual step.
//
// Re-runnable after a crash: each image's state is re-derived from where the
// file actually is (original path, trash, or neither).
//
// Dry-run by default.
//   deno run --allow-read --allow-write recon/executeDeletions.ts [--execute] [--limit N] [--db PATH]

import { loadParams } from "../lib/params.ts";
import { openDb, fileExists } from "../lib/db.ts";
import { logger } from "../lib/logger.ts";

interface PendingRow {
  action_id: number;
  img_id: number;
  path: string;
  name: string;
}

function argValue(flag: string): string | undefined {
  const i = Deno.args.indexOf(flag);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}

function dirExists(path: string): boolean {
  try {
    return Deno.statSync(path).isDirectory;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const execute = Deno.args.includes("--execute");
  const limit = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
  if (!(limit > 0)) throw new Error("--limit must be a positive number");

  const params = await loadParams();
  logger.setLogLevel(params.logLevel);
  const dbPath = argValue("--db") ?? params.dbPath;
  const slash = dbPath.lastIndexOf("/");
  const trashDir = (slash >= 0 ? dbPath.slice(0, slash) : ".") + "/trash";
  const db = openDb(dbPath);

  console.log(`${execute ? "EXECUTING" : "DRY RUN"} — trash folder: ${trashDir}\n`);

  const duplicateWhere =
    `action = 'delete' AND status = 'pending' AND action_id NOT IN (
       SELECT MIN(action_id) FROM actions
       WHERE action = 'delete' AND status = 'pending' GROUP BY img_id)`;
  const dupCount = (db.prepare(`SELECT COUNT(*) AS n FROM actions WHERE ${duplicateWhere}`).get() as { n: number }).n;
  if (dupCount > 0) {
    if (execute) {
      db.prepare(`DELETE FROM actions WHERE ${duplicateWhere}`).run();
      logger.info(`executeDeletions: removed ${dupCount} duplicate pending delete action(s)`);
    }
    console.log(`${execute ? "Removed" : "Would remove"} ${dupCount} duplicate pending delete action(s).\n`);
  }

  const all = db.prepare(
    `SELECT MIN(a.action_id) AS action_id, a.img_id, f.path, f.name
     FROM actions a
     JOIN fotos f ON f.img_id = a.img_id
     WHERE a.action = 'delete' AND a.status = 'pending'
     GROUP BY a.img_id
     ORDER BY action_id`
  ).all() as unknown as PendingRow[];
  const rows = all.slice(0, limit);
  console.log(`${all.length} image(s) with a pending delete; processing ${rows.length}.\n`);
  if (execute && rows.length > 0) Deno.mkdirSync(trashDir, { recursive: true });

  const setFotoDeleted = db.prepare("UPDATE fotos SET status = 'deleted' WHERE img_id = ?");
  const setDone = db.prepare("UPDATE actions SET status = 'done', status_dt = datetime('now') WHERE action_id = ?");
  const setFileGone = db.prepare(
    `UPDATE actions SET status = 'failed', status_dt = datetime('now'),
       info = COALESCE(info || ' | ', '') || 'file gone'
     WHERE action_id = ?`
  );

  const counts = { moved: 0, resumed: 0, fileGone: 0, failed: 0, skipped: 0 };

  function commit(row: PendingRow, actionUpdate: typeof setDone): void {
    db.exec("BEGIN");
    try {
      setFotoDeleted.run(row.img_id);
      actionUpdate.run(row.action_id);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  for (const row of rows) {
    const src = `${row.path}/${row.name}`;
    const dst = `${trashDir}/${row.img_id}_${row.name}`;
    const inPlace = fileExists(src);
    const inTrash = fileExists(dst);
    const tag = `action_id=${row.action_id} img_id=${row.img_id}`;

    if (inPlace && inTrash) {
      counts.skipped++;
      console.log(`CONFLICT   ${tag} — file is in both places, left untouched: ${src} / ${dst}`);
      continue;
    }

    if (inPlace) {
      if (!execute) {
        counts.moved++;
        console.log(`WOULD MOVE ${tag} — ${src}`);
        continue;
      }
      try {
        Deno.renameSync(src, dst);
      } catch (err) {
        counts.failed++;
        console.log(`FAIL       ${tag} — move to trash failed, nothing changed: ${err instanceof Error ? err.message : err}`);
        logger.error(`executeDeletions: ${tag} move to trash failed: ${src}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      try {
        commit(row, setDone);
      } catch (err) {
        Deno.renameSync(dst, src);
        counts.failed++;
        console.log(`FAIL       ${tag} — DB update failed, file moved back: ${err instanceof Error ? err.message : err}`);
        logger.error(`executeDeletions: ${tag} DB update failed, file moved back: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      counts.moved++;
      logger.info(`executeDeletions: ${tag} moved to trash: ${src}`);
      continue;
    }

    if (inTrash) {
      // A previous run moved the file but did not get to commit.
      counts.resumed++;
      console.log(`${execute ? "RESUMED   " : "WOULD RESUME"} ${tag} — already in trash, finishing DB update: ${dst}`);
      if (execute) commit(row, setDone);
      continue;
    }

    if (!dirExists(row.path)) {
      counts.skipped++;
      console.log(`SKIP       ${tag} — folder not found (volume disconnected?): ${row.path}`);
      continue;
    }

    counts.fileGone++;
    console.log(`${execute ? "FILE GONE " : "WOULD MARK"} ${tag} — file gone: ${src}`);
    if (execute) {
      commit(row, setFileGone);
      logger.warn(`executeDeletions: ${tag} file gone, fotos marked deleted, action failed: ${src}`);
    }
  }

  // Out of sync: a delete marked done but the file is still at its original path.
  const doneRows = db.prepare(
    `SELECT DISTINCT f.path, f.name FROM actions a JOIN fotos f ON f.img_id = a.img_id
     WHERE a.action = 'delete' AND a.status = 'done'`
  ).all() as unknown as { path: string; name: string }[];
  const outOfSync = doneRows.map((r) => `${r.path}/${r.name}`).filter(fileExists);

  console.log(`\nMoved to trash: ${counts.moved}  Resumed: ${counts.resumed}  File gone: ${counts.fileGone}  Failed: ${counts.failed}  Skipped: ${counts.skipped}`);
  if (outOfSync.length > 0) {
    console.log(`\nWARNING: ${outOfSync.length} 'done' delete(s) still have the file at the original path, e.g.:`);
    outOfSync.slice(0, 5).forEach((p) => console.log(`  ${p}`));
  }
  if (!execute) {
    console.log(`\nDry run — nothing was changed. Re-run with --execute (optionally --limit N) to apply.`);
  }
}

main();
