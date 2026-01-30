# Slideshow App

A local image slideshow application using Deno (server) and vanilla JavaScript (frontend). Displays images from a configurable folder with auto-advance and keyboard controls.

## Features

- Fullscreen image display (fits entire image, works for portrait/landscape)
- Auto-advance with configurable timing
- Keyboard controls for pause, navigation, and menu
- Breadth-first folder scanning, ordered by file creation date
- Image preloading for smooth transitions
- Logging to console and file

## Requirements

- [Deno](https://deno.land/) runtime

Install Deno:
```bash
curl -fsSL https://deno.land/install.sh | sh
```

## Configuration

Edit `params.json` to customize settings:

```json
{
  "imageFolderPath": "/path/to/your/images",
  "displayTimeMs": 5000,
  "maxDepth": 3,
  "maxFiles": 200
}
```

- `imageFolderPath` - Root folder containing images
- `displayTimeMs` - Time each image displays (milliseconds)
- `maxDepth` - How deep to scan subfolders
- `maxFiles` - Maximum number of images to load

## Running the App

1. Start the server:
   ```bash
   cd /Users/pwv16/b/projects/slideshow/claude
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
| Escape | Toggle menu |
| Left Arrow | Previous image |
| Right Arrow | Next image |

## Logs

Server activity is logged to `slideshow.log` in the project directory.
