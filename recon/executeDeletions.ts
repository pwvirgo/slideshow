// recon/executeDeletions.ts
//
// Executes pending 'delete' actions. First removes duplicate pending delete
// actions (keeps the lowest action_id per image). Then for each image: move
// the file into <trashDir>/<name> (or <stem>_<img_id><ext> if that name is
// already taken in trash), and in ONE transaction set
// fotos.status='deleted' and the action to 'done'. If the file is already
// gone: fotos.status='deleted', action 'failed' with 'file gone' in info.
// Emptying the trash is a separate, manual step.
//
// Re-runnable after a crash: each image's state is re-derived from where the
// file actually is (original path, trash, or neither). "In trash" is only
// recognised under an img_id-tagged name (<stem>_<img_id><ext>, or the older
// <img_id>_<name>); a plain <name> in trash can't be told apart from another
// image's file, so a crash in that window reports the image as "file gone".
//
// Trash is flat and never emptied here — the user empties it by hand.
//
// Guard: if the shared image root (params.imageFolderPath) is not there, the
// run aborts without changing anything — the unmounted-volume case. It does NOT
// check each image's own folder: a folder you deleted on purpose is a file-gone,
// not a reason to leave the action pending.
//
// Dry-run by default. Db file, trash folder and image root come from
// params.json (dataDir/dbName, trashDir, imageFolderPath); --db overrides the
// db file only.
// Prints a counts summary only; --verbose adds a line per image. Anything
// needing attention (failure, conflict, skip) is always printed. Everything
// printed is also appended to recon/recon.log (relative to the project root,
// so run from there), same log the notesToActions.sql run writes to.
//   deno run --allow-read --allow-write recon/executeDeletions.ts [--execute] [--limit N] [--db PATH] [--verbose]

import { loadParams, dbFile } from "../lib/params.ts";
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

// "a.b.jpg", 42 -> "a.b_42.jpg"; names without an extension just get "_42".
const SCRIPT = "recon/executeDeletions.ts";
const LOG_PATH = "recon/recon.log";
const encoder = new TextEncoder();
let logFile: Deno.FsFile | null = null;

// Print to the screen and append to recon/recon.log.
function say(msg = ""): void {
  console.log(msg);
  try {
    logFile ??= Deno.openSync(LOG_PATH, { create: true, append: true, write: true });
    logFile.writeSync(encoder.encode(msg + "\n"));
  } catch (err) {
    logger.warn(`executeDeletions: cannot write ${LOG_PATH}: ${err instanceof Error ? err.message : err}`);
  }
}

function taggedName(name: string, imgId: number): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)}_${imgId}${name.slice(dot)}` : `${name}_${imgId}`;
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
  const verbose = Deno.args.includes("--verbose");
  // Routine per-image progress: shown only with --verbose. Problems use console.log.
  const detail = verbose ? say : (_msg: string) => {};
  const limit = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
  if (!(limit > 0)) throw new Error("--limit must be a positive number");

  const params = await loadParams();
  logger.setLogLevel(params.logLevel);
  const dbPath = argValue("--db") ?? dbFile(params);
  const trashDir = params.trashDir.replace(/\/+$/, "");
  const imageRoot = params.imageFolderPath.replace(/\/+$/, "");

  say("");
  say(`=== ${SCRIPT} — ${execute ? "EXECUTING" : "DRY RUN"} ===`);
  say(`run_at ${new Date().toLocaleString()}   db ${dbPath}   trash ${trashDir}\n`);

  // Unmounted-volume guard, checked once for the whole run — the same guard
  // recon/findMissing.ts uses. This replaces a per-image check of each row's
  // own folder: that could not tell a disconnected volume from a folder the
  // owner deliberately deleted, so it skipped the latter and left its action
  // pending forever, which in turn blocked notesToActions.sql from ever
  // staging anything new. Checking the one shared root distinguishes the two.
  if (!dirExists(imageRoot)) {
    say(`ABORT — image root not found: ${imageRoot}`);
    say("The library looks unavailable (volume not mounted?). Nothing was changed.");
    logger.error(`executeDeletions: image root not found, aborted: ${imageRoot}`);
    Deno.exit(1);
  }

  const db = openDb(dbPath);

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
    say(`${execute ? "Removed" : "Would remove"} ${dupCount} duplicate pending delete action(s).\n`);
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
  if (rows.length === 0 && dupCount === 0) {
    say("Nothing to do — no pending delete actions. Nothing was changed.");
    return;
  }
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
    const plainDst = `${trashDir}/${row.name}`;
    const taggedDst = `${trashDir}/${taggedName(row.name, row.img_id)}`;
    const legacyDst = `${trashDir}/${row.img_id}_${row.name}`;
    const trashed = [taggedDst, legacyDst].find(fileExists);
    const inPlace = fileExists(src);
    const inTrash = trashed !== undefined;
    // New moves use the plain name unless another file already has it.
    const dst = trashed ?? (fileExists(plainDst) ? taggedDst : plainDst);
    const tag = `action_id=${row.action_id} img_id=${row.img_id}`;

    if (inPlace && inTrash) {
      counts.skipped++;
      say(`CONFLICT   ${tag} — file is in both places, left untouched: ${src} / ${dst}`);
      continue;
    }

    if (inPlace) {
      if (!execute) {
        counts.moved++;
        detail(`WOULD MOVE ${tag} — ${src}`);
        continue;
      }
      try {
        Deno.renameSync(src, dst);
      } catch (err) {
        counts.failed++;
        say(`FAIL       ${tag} — move to trash failed, nothing changed: ${err instanceof Error ? err.message : err}`);
        logger.error(`executeDeletions: ${tag} move to trash failed: ${src}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      try {
        commit(row, setDone);
      } catch (err) {
        Deno.renameSync(dst, src);
        counts.failed++;
        say(`FAIL       ${tag} — DB update failed, file moved back: ${err instanceof Error ? err.message : err}`);
        logger.error(`executeDeletions: ${tag} DB update failed, file moved back: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      counts.moved++;
      detail(`MOVED      ${tag} — ${src} -> ${dst}`);
      logger.debug(`executeDeletions: ${tag} moved to trash: ${src} -> ${dst}`);
      continue;
    }

    if (inTrash) {
      // A previous run moved the file but did not get to commit.
      counts.resumed++;
      detail(`${execute ? "RESUMED   " : "WOULD RESUME"} ${tag} — already in trash, finishing DB update: ${dst}`);
      if (execute) commit(row, setDone);
      continue;
    }

    // No per-folder check here: the image root was verified once at startup.
    // A missing folder at this point means the owner deleted it, which is a
    // file-gone, not a reason to freeze the action.
    counts.fileGone++;
    detail(`${execute ? "FILE GONE " : "WOULD MARK"} ${tag} — file gone: ${src}`);
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

  const label = execute ? "" : "would be ";
  say(`\n${all.length} image(s) with a pending delete; ${rows.length} processed.`);
  say(`  moved to trash   ${counts.moved}\t(file ${label}moved, fotos deleted, action done)`);
  say(`  resumed          ${counts.resumed}\t(already in trash, db ${label}finished)`);
  say(`  file gone        ${counts.fileGone}\t(fotos ${label}deleted, action failed)`);
  say(`  failed           ${counts.failed}\t(nothing changed)`);
  say(`  skipped          ${counts.skipped}\t(file in both places)`);
  if (outOfSync.length > 0) {
    say(`\nWARNING: ${outOfSync.length} 'done' delete(s) still have the file at the original path, e.g.:`);
    outOfSync.slice(0, 5).forEach((p) => say(`  ${p}`));
  }
  if (!execute) {
    say(`\nDry run — nothing was changed. Re-run with --execute (optionally --limit N) to apply.`);
  }
}

main();
