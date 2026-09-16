# Slideshow App

A local fullscreen image slideshow. A Deno/TypeScript server serves images from
either a folder or a SQLite database; a vanilla-JS frontend displays them with
auto-advance and keyboard controls. In database mode you can annotate images with
notes, and images whose files have gone missing are flagged automatically — and
unflagged if they come back.

No build step — Deno runs the TypeScript directly.

## Requirements

- [Deno](https://deno.land/) 2.x

## Running

```bash
deno run --allow-read --allow-net --allow-write server.ts
```

Then open <http://localhost:8000>.

Permissions: `--allow-read` (images, `params.json`, the database), `--allow-net`
(HTTP server on port 8000), `--allow-write` (`slideshow.log`, and note inserts in
database mode).

## Configuration

Settings live in `params.json` at the project root.

**Folder mode** — scan a directory tree for images:

```json
{
  "source": "folder",
  "imageFolderPath": "/path/to/images",
  "displayTimeMs": 5000,
  "maxDepth": 3,
  "maxFiles": 200,
  "logLevel": "INFO"
}
```

**Database mode** — read image records from a SQLite `fotos` table:

```json
{
  "source": "db",
  "imageFolderPath": "/path/to/images",
  "dataDir": "../photos",
  "dbName": "photos3.db",
  "trashDir": "../photos/trash",
  "whereClause": "camera LIKE '%Canon%'",
  "orderBy": "dt_taken DESC",
  "displayTimeMs": 5000,
  "maxFiles": 2000,
  "logLevel": "INFO"
}
```

| Field | Meaning |
|-------|---------|
| `source` | `"folder"` or `"db"` |
| `imageFolderPath` | Folder mode only: the directory to scan. Not used in database mode — the `fotos` table stores absolute paths and they are served as-is. |
| `dataDir` | Folder holding the database (database mode). Relative paths are resolved from the project root. |
| `dbName` | SQLite file name inside `dataDir`, e.g. `photos3.db`. (Replaces the old `dbPath`; an old `dbPath` is still split into these two with a warning.) |
| `trashDir` | Where `recon/executeDeletions.ts` moves deleted files. Optional — defaults to `<dataDir>/trash`. Must be on the same volume as the images. |
| `whereClause` | SQL `WHERE` fragment applied to the `fotos` query (database mode, optional). The query runs on a read-only connection, so a fragment cannot modify anything — SQLite itself refuses. A `;` is rejected, because only the first statement would run and the rest would be silently discarded. It only ever sees live rows (`status='deleted'` images are filtered out automatically), so it needs no `status` condition. Values containing SQL keywords are fine, e.g. `img_id NOT IN (SELECT img_id FROM notes WHERE category='delete')`. |
| `orderBy` | SQL `ORDER BY` fragment for the `fotos` query (database mode, optional). Same rules. |
| `displayTimeMs` | Milliseconds each image is shown (minimum 100). |
| `maxDepth` | Subfolder scan depth (folder mode, minimum 1). |
| `maxFiles` | Cap on how many images are loaded. |
| `logLevel` | `DEBUG`, `INFO`, `WARN`, or `ERROR`. |

Folder mode discovers `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` breadth-first and
orders them by file creation time.

## Control Panel

Browse to <http://localhost:8000/params> (or press <kbd>Esc</kbd> → **Settings**).

- **Display time** and **Logging detail** take effect immediately.
- **Source**, **database path**, **where clause**, **order by**, **image folder
  path**, **max depth**, and **max files** are written to `params.json` on
  **Save** and take effect after a server restart.

## Using the Slideshow

The slideshow auto-advances every `displayTimeMs`. The next image is preloaded so
transitions are instant. A counter in the corner shows position in the list.

| Key | Action |
|-----|--------|
| <kbd>Space</kbd> | Pause / resume |
| <kbd>Esc</kbd> | Open / close the menu |
| <kbd>&larr;</kbd> | Previous image |
| <kbd>&rarr;</kbd> | Next image |
| <kbd>I</kbd> | Toggle the info overlay (database mode) |
| <kbd>N</kbd> | Open the Notes form (database mode) |

If an image fails to load mid-slideshow (for example, the drive was
disconnected), the slideshow pauses on an error screen: <kbd>Space</kbd> retries,
<kbd>&larr;</kbd>/<kbd>&rarr;</kbd> move on, <kbd>Esc</kbd> opens the menu.

### Info overlay (database mode)

<kbd>I</kbd> toggles a corner overlay with the current image's `IMG_ID` and MD5
(on one line), filename, camera, full path, date taken / created, size in KB,
and pixel dimensions.

## Notes (database mode)

<kbd>N</kbd> (or menu → **Notes**) opens a draggable form over the image — drag
its title bar to move it. It shows the image's identity (filename, `IMG_ID`,
camera, path, dates, size) and captures:

- **Category** — free text, up to 16 characters
- **Rank** — 1 to 5
- **Comment** — free text, up to 1024 characters

<kbd>Enter</kbd> in the Category or Rank field saves; in the Comment box
<kbd>Enter</kbd> is a newline. <kbd>Esc</kbd> closes without saving. Each save
inserts one row into the `notes` table.

## Missing files (database mode)

The image list is taken straight from the database; the server does not check the
filesystem at startup. Instead, each image's file is checked the moment the
slideshow is about to show it:

- If the file exists, it is displayed normally.
- If the file is missing, the slideshow shows a brief **"Photo missing —
  skipped"** message for the normal display time, then advances. The first time a
  given image is found missing, one row is inserted into `notes` with
  `category = 'missing'`, `rank = 5`, and a comment recording the path. Later
  encounters with the same missing image do not add duplicate notes.

Nothing in the `fotos` table is changed.

That check only ever sees images the current `whereClause` selects, so files
deleted outside that selection go unnoticed. To sweep the whole catalog, run the
scanner from the project root:

```bash
# dry run: print what would change, change nothing
deno run --allow-read --allow-write recon/findMissing.ts

# add a line per image
deno run --allow-read --allow-write recon/findMissing.ts --verbose

# apply it
deno run --allow-read --allow-write recon/findMissing.ts --execute
```

It walks every `status='ok'` row and keeps the `missing` notes in step with the
disk **in both directions**:

| file on disk | has a `missing` note | what happens |
| --- | --- | --- |
| gone | no | one note added — `category='missing'`, `rank=5`, comment ends `(scan)` |
| gone | yes | nothing |
| present | yes | the note is **deleted** — the file came back |
| present | no | nothing |

The `(scan)` marker in the comment is what distinguishes these from the notes
the slideshow writes as it goes.

Clearing the note when a file reappears is deliberate: a `missing` note is a
cached observation, re-derivable by re-scanning, so a stale one is worse than
none. Notes are deleted whatever comment they carry. The history is kept in
`recon/recon.log`, which records every insert and delete.

**If `imageFolderPath` is not present, the run aborts and writes nothing.** That
is the unmounted-volume case, where every file would otherwise look missing at
once. It deliberately does *not* check each image's own folder — a folder you
deleted on purpose should still be flagged.

The scanner only ever writes to `notes`. It never touches `fotos`, `actions`, or
any file.

To keep flagged images out of the slideshow while you decide what to do with
them, set `whereClause` to:

```
img_id NOT IN (SELECT img_id FROM notes WHERE LOWER(TRIM(category))='missing')
```

Note that hiding them also stops the per-slide check from ever reaching them, so
the scanner becomes the only thing that notices changes — the database is then
only as current as your last scan.

**A `missing` note does not delete anything.** It is a flag for you, and nothing
promotes it on its own — `recon/notesToActions.sql` stages `category='delete'`
notes only and ignores `missing` ones. To act on a missing file, mark it
`delete` (in the Notes form, or by adding a `delete` note) and then run the
deletion steps below. That split is what makes the automatic note-clearing safe:
a bad scan can annotate, but it can never stage a deletion.

## Deleting images (database mode)

Deletion is never done by the slideshow itself. It is a two-step, run-by-hand
process from the project root:

1. **Execute pending deletes** — for every `actions` row with `action='delete'`
   and `status='pending'`, move the file to `<trashDir>/<name>` — or `<stem>_<img_id><ext>` if a file with that name is already in trash (older runs used `<img_id>_<name>`),
   set `fotos.status='deleted'` and the action to `done`. Duplicate pending
   deletes for the same image are removed first. If the file is already gone,
   the image is still marked `deleted` and the action is `failed` with
   `file gone` in `info`. Dry run by default:

   ```bash
   # 1. dry run: print what would happen, change nothing
   deno run --allow-read --allow-write recon/executeDeletions.ts

   # 2. real run on the first pending image only; check it before going on
   deno run --allow-read --allow-write recon/executeDeletions.ts --execute --limit 1
   
   # 3. real run on everything still pending
   deno run --allow-read --allow-write recon/executeDeletions.ts --execute
   ```

   Safe to re-run after an interruption: a file already in trash under an
   img_id-tagged name just gets its database update finished.

   **If `imageFolderPath` is not present, the run aborts and changes nothing** —
   the unmounted-volume case, checked once for the whole run. It does *not*
   check each image's own folder: a folder you deleted yourself is a file-gone,
   and its image is marked `deleted` like any other. (An earlier version skipped
   those, which left their actions `pending` forever and blocked step 2 from
   ever running again.)

   Emptying `trashDir` is a separate manual step — you do it when you choose.

2. **Stage new deletes from notes** — turn `notes` with `category='delete'` into
   one pending `delete` action per image. Refuses to run while any action is
   still pending, so step 1 has to have cleared them first:

   ```bash
   sqlite3 <dataDir>/<dbName> < recon/notesToActions.sql   # currently ../photos/photos3.db
   ```

   One action per image, however many `delete` notes that image has. The
   `info` column is set to the note's **comment, verbatim** — so a note commented
   `thumbnail` produces an action with `info = 'thumbnail'`. If an image has
   several delete notes their comments are joined with ` | `; if none of them
   carried a comment, `info` is `NULL`. Notes with `category='missing'` are
   ignored — see "Missing files" above.

   **Images that already have a `delete` action are skipped**, whatever that
   action's status — `done`, `pending` or `failed`. So a note on a photo you
   already deleted does not re-stage it, and neither does re-running the script.
   Images with no `fotos` row are skipped too. Every skip is printed with its
   reason:

   ```
   SKIPPED  7632  already has a delete action  /Users/…/P6240020.JPG
   STAGED   0
   ```

   Note that **the notes themselves are never consumed or marked** — they stay
   as they are. That means every past `delete` note is re-examined and
   re-skipped on every future run, so once a batch has been executed you should
   expect that many `SKIPPED` lines each time. It is noise, not a problem:
   nothing is staged twice.

   Output goes to the screen and is appended to `recon/recon.log`, the same log
   the other two scripts write to. Errors go to the screen only, unless you add
   `2>> recon/recon.log`.

## Database

In database mode the app reads from the `fotos` table and writes to `notes`
(the deletion scripts above also write `actions` and `fotos.status`):

- **`fotos`** — one row per image (`img_id`, `path`, `name`, `status`, `bytes`,
  `dt_taken`, `dt_created`, `camera`, `img_size`, `md5`, …). Owned and populated
  by a separate application.
- **`notes`** — annotations added here (`note_id`, `category`, `rank`, `comment`,
  `img_id`, `note_dt`). Written by the Notes form and by missing-file detection
  (both the per-slide check and `recon/findMissing.ts`, which also deletes
  `missing` notes when a file reappears).
- **`actions`** — staged changes (`action_id`, `action`, `info`, `request_dt`,
  `status_dt`, `status`, `img_id`). Pending `delete` rows are executed by
  `recon/executeDeletions.ts`.

A `v_notes` view (`notes` left-joined to `fotos`) is available for reviewing
notes alongside each image's path and status.

## Logs

Server activity is written to both the console and `slideshow.log` in the project
directory. The level is set by `logLevel` in `params.json` and can be changed
live from the Control Panel.
