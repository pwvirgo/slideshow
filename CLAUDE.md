# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Local image slideshow web app. Deno backend (TypeScript) serves images from a configurable folder. Vanilla JS frontend displays them fullscreen with auto-advance and keyboard controls.

## Running the App

```bash
deno run --allow-read --allow-net --allow-write server.ts
```

Opens at `http://localhost:8000`. No build step — Deno runs TypeScript directly.

Permissions: `--allow-read` (images, params.json), `--allow-net` (HTTP server), `--allow-write` (slideshow.log).

There is no test framework or linter configured.

## Architecture

**Backend (`server.ts`)** — Single HTTP server using `Deno.serve()` on port 8000. Routes:
- `GET /` → slideshow viewer (`static/slides.html`)
- `GET /params` → settings page (`static/params.html`)
- `GET /static/*` → JS, CSS assets
- `GET /api/images` → JSON image list (optional `?folder=` filter)
- `GET /api/params` → current params.json values
- `POST /api/logLevel` → change runtime log level
- `GET /images/*` → serves actual image files

**Libraries (`lib/`):**
- `params.ts` — loads and validates `params.json` with defaults and type checking
- `scanner.ts` — breadth-first image discovery (.jpg, .jpeg, .png, .gif, .webp), sorted by creation date (birthtime), respects maxDepth/maxFiles
- `logger.ts` — four-level logger (DEBUG/INFO/WARN/ERROR), writes to both console and `slideshow.log`, level changeable at runtime

**Frontend (`static/`):**
- `app.js` — slideshow controller (IIFE). Manages image cycling, preloading, pause/resume, keyboard controls (Space, Esc, arrows). Reads URL params: `?index=`, `?displayTimeMs=`, `?folder=`
- `params.js` — settings page controller (IIFE). Loads/displays params, controls log level via API
- `styles.css` — dark theme, fullscreen image display with `object-fit: contain`

## Configuration

`params.json` at project root:
- `imageFolderPath` — absolute path to image folder
- `displayTimeMs` — ms per slide (minimum 100)
- `maxDepth` — subfolder scan depth (minimum 1)
- `maxFiles` — image cap (minimum 1)
- `logLevel` — DEBUG/INFO/WARN/ERROR

## Naming Conventions

Use "params" (not "config") throughout the codebase — this was an intentional rename.
