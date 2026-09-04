# Slideshow App

A local fullscreen image slideshow. A Deno/TypeScript server serves images from
either a folder or a SQLite database; a vanilla-JS frontend displays them with
auto-advance and keyboard controls. In database mode you can annotate images with
notes, and images whose files have gone missing are flagged automatically.

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
  "dbPath": "../photos/photos3.db",
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
| `dbPath` | Path to the SQLite file (database mode). Relative paths are resolved from the project root. |
| `whereClause` | SQL `WHERE` fragment applied to the `fotos` query (database mode, optional). Read-only fragments only — anything that could modify data is rejected. It only ever sees live rows (`status='deleted'` images are filtered out automatically), so it needs no `status` condition. |
| `orderBy` | SQL `ORDER BY` fragment for the `fotos` query (database mode, optional). Same read-only restriction. |
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

Nothing in the `fotos` table is changed. Reviewing and clearing these `missing`
notes — and deleting images — is a separate workflow, not yet built (see
`design/reconcile.md`).

## Database

In database mode the app reads from the `fotos` table and writes only to `notes`:

- **`fotos`** — one row per image (`img_id`, `path`, `name`, `status`, `bytes`,
  `dt_taken`, `dt_created`, `camera`, `img_size`, `md5`, …). Owned and populated
  by a separate application.
- **`notes`** — annotations added here (`note_id`, `category`, `rank`, `comment`,
  `img_id`, `note_dt`). Written by the Notes form and by missing-file detection.

A `v_notes` view (`notes` left-joined to `fotos`) is available for reviewing
notes alongside each image's path and status.

## Logs

Server activity is written to both the console and `slideshow.log` in the project
directory. The level is set by `logLevel` in `params.json` and can be changed
live from the Control Panel.
