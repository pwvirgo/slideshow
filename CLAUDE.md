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
- `GET /api/imageInfo/<index>` → DB mode: returns foto id and path for an image
- `POST /api/actions` → DB mode: record an action on an image
- `GET /images/*` → serves actual image files (folder mode: relative path, DB mode: index into image list)

**Libraries (`lib/`):**
- `params.ts` — loads and validates `params.json` with defaults and type checking
- `scanner.ts` — breadth-first image discovery (.jpg, .jpeg, .png, .gif, .webp), sorted by creation date (birthtime), respects maxDepth/maxFiles
- `db.ts` — SQLite interface using Deno's `node:sqlite`. Queries fotos table with optional WHERE clause, inserts actions. Creates actions table if missing.
- `logger.ts` — four-level logger (DEBUG/INFO/WARN/ERROR), writes to both console and `slideshow.log`, level changeable at runtime

**Frontend (`static/`):**
- `app.js` — slideshow controller (IIFE). Manages image cycling, preloading, pause/resume, keyboard controls (Space, Esc, arrows). In DB mode: fetches image metadata and records actions via keyboard (f=favorite, d=delete, r=rotate).
- `params.js` — settings page controller (IIFE). Loads/displays params, controls log level via API, toggles UI between folder and DB source modes.
- `styles.css` — dark theme, fullscreen image display with `object-fit: contain`

## Configuration

`params.json` at project root:
- `source` — `"folder"` or `"db"` (image source mode)
- `imageFolderPath` — absolute path to image folder (folder mode)
- `dbPath` — path to SQLite database file (DB mode)
- `whereClause` — SQL WHERE filter for fotos table (DB mode, optional)
- `displayTimeMs` — ms per slide (minimum 100)
- `maxDepth` — subfolder scan depth (minimum 1, folder mode)
- `maxFiles` — image cap (minimum 1)
- `logLevel` — DEBUG/INFO/WARN/ERROR

## Database Schema

The SQLite database (`fotos.db`) has two tables:
- `fotos` — one row per image: id, path, name, bytes, dt_taken, dt_created, camera, lens, lat, lon, img_size, duration, MD5
- `actions` — user actions on images: id, foto_id (FK to fotos), act, dt_act, note

## Naming Conventions

Use "params" (not "config") throughout the codebase — this was an intentional rename.
