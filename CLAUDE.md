# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Local image slideshow web app. Deno backend (TypeScript) serves images from either a configurable folder or a SQLite database. Vanilla JS frontend displays them fullscreen with auto-advance and keyboard controls. In DB mode, users annotate images with notes (category/rank/comment) saved to the `notes` table; images whose files have gone missing on disk are auto-flagged with a `category='missing'` note. Destructive changes (deletion) are staged in the `actions` table and executed by a separate script — never inline.

## Running the App

```bash
deno run --allow-read --allow-net --allow-write server.ts
```

Opens at `http://localhost:8000`. No build step — Deno runs TypeScript directly.

Permissions: `--allow-read` (images, params.json, the SQLite db), `--allow-net` (HTTP server), `--allow-write` (slideshow.log, and `notes` inserts on the db in DB mode).

There is no test framework or linter configured.

## Architecture

**Backend (`server.ts`)** — Single HTTP server using `Deno.serve()` on port 8000. Routes:
- `GET /` → slideshow viewer (`static/slides.html`)
- `GET /params` → settings page (`static/params.html`)
- `GET /static/*` → JS, CSS assets
- `GET /api/images` → JSON image list (optional `?folder=` filter in folder mode)
- `GET /api/params` → current params.json values
- `POST /api/params` → write editable params to params.json (takes effect on restart)
- `POST /api/logLevel` → change runtime log level
- `GET /api/imageInfo/<index>` → DB mode: returns id, name, path, dtTaken, dtCreated, bytes, imgSize, camera, md5, and `missing`. Side effect: if the file is missing on disk, logs a WARN and inserts one `category='missing'` note (guarded by `hasMissingNote`). Never touches `fotos` or `actions`.
- `POST /api/notes` → DB mode: insert a row into `notes` (category, rank, comment, img_id)
- `POST /api/actions` → DB mode: insert a pending row into `actions`. Present but the UI does not currently call it — delete staging is done via SQL (see `design/SS_Document.md`).
- `GET /images/*` → serves actual image files (folder mode: relative path under imageFolderPath, DB mode: index into image list → absolute path from the fotos row)

**Libraries (`lib/`):**
- `params.ts` — loads and validates `params.json` with defaults and type checking
- `scanner.ts` — breadth-first image discovery (.jpg, .jpeg, .png, .gif, .webp), sorted by creation date (birthtime), respects maxDepth/maxFiles
- `db.ts` — SQLite interface using Deno's `node:sqlite`. `queryImages()` selects `img_id, path, name` from `fotos` with the optional `whereClause` / `orderBy` fragments and a `maxFiles` limit; it does **not** touch the filesystem. It wraps the query in `WITH fotos AS (SELECT * FROM main.fotos WHERE status = 'ok') …` so the CTE name `fotos` shadows the real table everywhere — the whereClause and any self-reference in it (e.g. a correlated `FROM fotos b` for md5 dedup) only ever see live rows; `status='deleted'` rows are invisible. `getImageInfo()` returns per-image metadata incl. `md5` (selected as `MD5 AS md5`). `insertNote()` / `insertAction()` do parameterized inserts. `hasMissingNote()` checks for an existing `category='missing'` note. `moveToDeleted()` still targets a `deleted` table that no longer exists — **stale, unused by the server; see `design/reconcile.md`**.
- `logger.ts` — four-level logger (DEBUG/INFO/WARN/ERROR), writes to both console and `slideshow.log`, level changeable at runtime

**Frontend (`static/`):**
- `app.js` — slideshow controller (IIFE). Manages image cycling, preloading, pause/resume, keyboard controls (Space, Esc, arrows, `I` info overlay, `N` notes). In DB mode: fetches per-image metadata via `/api/imageInfo/<index>` before loading each slide — if that response says `missing: true`, shows a brief "Photo missing — skipped" message for `displayTimeMs` and advances instead of loading a broken image. Shows a draggable Notes form for annotating images, saved to the `notes` table via `POST /api/notes`. The `I` info overlay shows IMG_ID + MD5, name, camera, path, dates, size.
- `params.js` — settings page controller (IIFE). Loads/displays params, controls log level via API, toggles UI between folder and DB source modes.
- `styles.css` — dark theme, fullscreen image display with `object-fit: contain`

## Configuration

`params.json` at project root:
- `source` — `"folder"` or `"db"` (image source mode)
- `imageFolderPath` — **folder mode only:** root directory to scan. Not used in DB mode — the `fotos` table stores absolute paths and they are served as-is. (Older docs said this was a base path prepended to DB paths; that is no longer true.)
- `dbPath` — path to the SQLite database file, resolved from the project root (DB mode). Currently `../photos/photos3.db`.
- `tableName` — present in `params.json` but **not yet wired into the code** (`fotos` is still hard-coded). Reserved for running the slideshow against temporary tables later.
- `whereClause` — SQL `WHERE` fragment for the `fotos` query (DB mode, optional). Read-only fragments only — `insert/update/delete/drop/alter/create` and `;` are rejected. It sees only `status='ok'` rows (see `queryImages()` above), so it needs no `status` filter of its own.
- `orderBy` — SQL `ORDER BY` fragment for the `fotos` query (DB mode, optional). Same read-only restriction.
- `displayTimeMs` — ms per slide (minimum 100)
- `maxDepth` — subfolder scan depth (minimum 1, folder mode)
- `maxFiles` — image cap (minimum 1)
- `logLevel` — DEBUG/INFO/WARN/ERROR
- Unknown keys (e.g. `whereClause1`, `comment1`) are ignored by `loadParams()` and can be used to park alternate values.

## Database Schema

The SQLite database (`../photos/photos3.db`) has three tables and one view.
`fotos` is owned and populated by a **separate** project (`../photos`); this app
only reads it and writes `notes` / `actions`.

- `fotos` — `img_id` (PK), `path`, `name`, `status` (`CHECK(status IN ('ok','deleted'))` default `'ok'`), `bytes`, `dt_taken`, `dt_created`, `camera`, `lens`, `lat`, `lon`, `img_size`, `duration`, `md5`. A previous scheme moved deleted rows to a `deleted` table; that table is gone — deletion is now the soft `status='deleted'`.
- `notes` — `note_id` (PK), `category` (free text), `rank` (`CHECK(rank IN (1..5))`), `comment`, `img_id` (FK → fotos), `note_dt` (default now). Written by the Notes form and by missing-file detection (`category='missing'`, `rank=5`).
- `actions` — `action_id` (PK), `action` (`CHECK` one of `mv/delete/rotate/resize/crop/edit/other` — **no `'missing'`**), `info`, `request_dt` (default now), `status_dt`, `status` (`CHECK` one of `done/pending/failed`, default `pending`), `img_id` (FK → fotos).
- `v_notes` — view: `notes` LEFT JOIN `fotos` on `img_id`, exposing note fields plus `status`, `path`, `name`, `full_path`, `md5`, etc. Read helper for reviewing notes (esp. the future missing-file reconciliation); nothing writes through it.

`node:sqlite` enforces foreign keys by default; `openDb()` turns them **off**
(`PRAGMA foreign_keys = OFF`) on purpose, so `notes`/`actions` rows can outlive
soft-deleted `fotos` rows as an audit trail.

## CSS Philosophy

Prefer simple, reusable styles over element-specific styling:
- Define CSS variables in `:root` for colors, spacing, radii
- Create a small set of utility classes (`.btn`, `.input`, `.overlay`, `.panel`, `.indicator`) and reuse them
- Use IDs only for JavaScript hooks; style via classes
- Avoid duplicating styles — if two elements look similar, they should share a class

## Naming Conventions

Use "params" (not "config") throughout the codebase — this was an intentional rename.

## Session Notes

**Environment:**
- Project is at `/Users/mac24/a/projects/slideshow` (also used on an iMac — paths may differ)
- Database: `/Users/mac24/a/projects/photos/photos3.db` (`../photos/photos3.db` in params.json), built and owned by the `../photos` project
- Images are under `/Users/mac24/a/projects/photos/images3/` (absolute paths stored in `fotos.path`)
- Remote: `github.com:pwvirgo/slideshow.git`

**SQLite / Deno gotcha:**
- Deno's `node:sqlite` keys result rows by the column's declared case. `photos3.db` declares `md5` lowercase, but keep the `MD5 AS md5` alias in queries (as `getImageInfo()` does) and access via `row.md5` so it stays correct if the column is ever `MD5` again.

**TIFF detection gotcha:**
- The `file` command incorrectly identifies many valid JPEGs as TIFF because JPEG EXIF metadata uses TIFF format internally.
- To reliably detect true TIFF files, check magic bytes: JPEG starts with `FF D8`, TIFF starts with `49 49 2A 00` (little-endian) or `4D 4D 00 2A` (big-endian).
- Use Python to check: `magic = open(path,'rb').read(4); is_tiff = magic[:2] != b'\xff\xd8' and magic[:4] in (b'\x49\x49\x2a\x00', b'\x4d\x4d\x00\x2a')`
- `sips -s format jpeg "$f" --out "$f"` converts TIFF to JPEG in place safely.
