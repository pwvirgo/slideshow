# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Local image slideshow web app. Deno backend (TypeScript) serves images from either a configurable folder or a SQLite database. Vanilla JS frontend displays them fullscreen with auto-advance and keyboard controls. In DB mode, users can record actions (favorite, delete, rotate) on images.

## Running the App

```bash
deno run --allow-read --allow-net --allow-write server.ts
```

Opens at `http://localhost:8000`. No build step — Deno runs TypeScript directly.

Permissions: `--allow-read` (images, params.json, fotos.db), `--allow-net` (HTTP server), `--allow-write` (slideshow.log, fotos.db for actions).

There is no test framework or linter configured.

## Architecture

**Backend (`server.ts`)** — Single HTTP server using `Deno.serve()` on port 8000. Routes:
- `GET /` → slideshow viewer (`static/slides.html`)
- `GET /params` → settings page (`static/params.html`)
- `GET /static/*` → JS, CSS assets
- `GET /api/images` → JSON image list (optional `?folder=` filter in folder mode)
- `GET /api/params` → current params.json values
- `POST /api/logLevel` → change runtime log level
- `GET /api/imageInfo/<index>` → DB mode: returns id, name, path, dtCreated, md5, imgSize for an image
- `POST /api/actions` → DB mode: record an action on an image
- `GET /images/*` → serves actual image files (folder mode: relative path, DB mode: index into image list)

**Libraries (`lib/`):**
- `params.ts` — loads and validates `params.json` with defaults and type checking
- `scanner.ts` — breadth-first image discovery (.jpg, .jpeg, .png, .gif, .webp), sorted by creation date (birthtime), respects maxDepth/maxFiles
- `db.ts` — SQLite interface using Deno's `node:sqlite`. Queries fotos table with optional WHERE clause, inserts actions. Creates actions table if missing. `queryImages()` accepts optional `basePath` prepended to `path`+`name` from DB rows (for portability — DB stores relative paths, basePath comes from `imageFolderPath`). Returns `sampleSkippedPath` (first missing file path) for error reporting.
- `logger.ts` — four-level logger (DEBUG/INFO/WARN/ERROR), writes to both console and `slideshow.log`, level changeable at runtime

**Frontend (`static/`):**
- `app.js` — slideshow controller (IIFE). Manages image cycling, preloading, pause/resume, keyboard controls (Space, Esc, arrows). In DB mode: fetches image metadata (id, path, md5, imgSize) and shows a draggable Notes form for annotating images (saved to CSV via `/api/notes`).
- `params.js` — settings page controller (IIFE). Loads/displays params, controls log level via API, toggles UI between folder and DB source modes.
- `styles.css` — dark theme, fullscreen image display with `object-fit: contain`

## Configuration

`params.json` at project root:
- `source` — `"folder"` or `"db"` (image source mode)
- `imageFolderPath` — path to image folder. In folder mode: root to scan. In DB mode: base path prepended to `path`+`name` from the fotos table (e.g. `/Users/mac24/a/projects/fotos/images`). Required in folder mode; optional (but needed) in DB mode.
- `dbPath` — path to SQLite database file (DB mode)
- `csvPath` — path to CSV file for saving notes (DB mode)
- `whereClause` — SQL WHERE filter for fotos table (DB mode, optional)
- `displayTimeMs` — ms per slide (minimum 100)
- `maxDepth` — subfolder scan depth (minimum 1, folder mode)
- `maxFiles` — image cap (minimum 1)
- `logLevel` — DEBUG/INFO/WARN/ERROR

## Database Schema

The SQLite database (`fotos.db`) has two tables:
- `fotos` — one row per image: id, path, name, bytes, dt_taken, dt_created, camera, lens, lat, lon, img_size, duration, MD5
- `actions` — user actions on images: id, foto_id (FK to fotos), act, dt_act, note

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
- Fotos database: `/Users/mac24/a/projects/fotos/fotos.db` (referenced as `../fotos/fotos.db` in params.json)
- Images are in `/Users/mac24/a/projects/fotos/keep/images/`
- Remote: `github.com:pwvirgo/slideshow.git`

**SQLite / Deno gotcha:**
- Deno's `node:sqlite` returns the `MD5` column as lowercase `md5`. Always use `MD5 AS md5` alias in queries and access via `row.md5`.

**TIFF detection gotcha:**
- The `file` command incorrectly identifies many valid JPEGs as TIFF because JPEG EXIF metadata uses TIFF format internally.
- To reliably detect true TIFF files, check magic bytes: JPEG starts with `FF D8`, TIFF starts with `49 49 2A 00` (little-endian) or `4D 4D 00 2A` (big-endian).
- Use Python to check: `magic = open(path,'rb').read(4); is_tiff = magic[:2] != b'\xff\xd8' and magic[:4] in (b'\x49\x49\x2a\x00', b'\x4d\x4d\x00\x2a')`
- `sips -s format jpeg "$f" --out "$f"` converts TIFF to JPEG in place safely.
