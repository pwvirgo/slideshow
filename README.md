# Slideshow App

A local image slideshow application using Deno (server) and vanilla JavaScript (frontend). Displays images from a configurable folder with auto-advance and keyboard controls.

## Features

- Fullscreen image display (fits entire image, works for portrait/landscape)
- Auto-advance with configurable timing
- Keyboard controls for pause, navigation, and menu
- Two image sources: folder scan or SQLite database
- Breadth-first folder scanning, ordered by file creation date
- Image preloading for smooth transitions
- DB mode: draggable Notes form to annotate images, saved to CSV
- Logging to console and file

## Requirements

- [Deno](https://deno.land/) runtime

Install Deno:
```bash
curl -fsSL https://deno.land/install.sh | sh
```

## Configuration

Edit `params.json` to customize settings.

**Folder mode** (scans a directory for images):
```json
{
  "source": "folder",
  "imageFolderPath": "/path/to/your/images",
  "displayTimeMs": 5000,
  "maxDepth": 3,
  "maxFiles": 200
}
```

**DB mode** (reads from a SQLite `fotos` database):
```json
{
  "source": "db",
  "imageFolderPath": "/path/to/your/images",
  "dbPath": "/path/to/fotos.db",
  "csvPath": "notes.csv",
  "whereClause": "",
  "displayTimeMs": 5000,
  "maxFiles": 200
}
```

- `source` - `"folder"` or `"db"`
- `imageFolderPath` - Root folder containing images. In folder mode: the directory to scan. In DB mode: base path prepended to image paths stored in the database — set this to wherever your images live on the current machine.
- `dbPath` - Path to SQLite database (DB mode)
- `csvPath` - Path to CSV file for saving notes (DB mode)
- `whereClause` - SQL WHERE filter for the fotos table, e.g. `camera LIKE '%Canon%'` (DB mode, optional)
- `displayTimeMs` - Time each image displays (milliseconds)
- `maxDepth` - How deep to scan subfolders (folder mode)
- `maxFiles` - Maximum number of images to load

## Running the App

1. Start the server:
   ```bash
   deno run --allow-read --allow-net --allow-write server.ts
   ```

2. Open your browser to:
   ```
   http://localhost:8000
   ```

## Keyboard Controls

| Key | Action |
|-----|--------|
| Spacebar | Pause / Resume |
| Escape | Open menu (or menu → slideshow when open) |
| Left Arrow | Previous image |
| Right Arrow | Next image |

**DB mode — Notes form** (open via menu → Notes):

| Key | Action |
|-----|--------|
| Escape | Close Notes form |
| Enter | Save note (when in a single-line field) |

Drag the "Notes" title bar to reposition the form over the image.

## Logs

Server activity is logged to `slideshow.log` in the project directory.
