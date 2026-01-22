import { logger } from "./lib/logger.ts";
import { loadConfig, Config } from "./lib/config.ts";
import { scanImages } from "./lib/scanner.ts";

const PORT = 8000;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

async function serveFile(path: string): Promise<Response> {
  try {
    const file = await Deno.readFile(path);
    return new Response(file, {
      headers: { "Content-Type": getMimeType(path) },
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return new Response("Not Found", { status: 404 });
    }
    logger.error(`Error serving file ${path}: ${error}`);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function main(): Promise<void> {
  logger.info("Starting slideshow server...");

  const config = await loadConfig();
  const images = await scanImages(config);

  // Convert absolute paths to relative paths for the API
  const imagePaths = images.map((img) => {
    // Return path relative to the image folder
    return img.replace(config.imageFolderPath, "").replace(/^\//, "");
  });

  logger.info(`Server starting on http://localhost:${PORT}`);

  Deno.serve({ port: PORT }, async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    logger.debug(`${request.method} ${pathname}`);

    // Route: GET / - Serve index.html
    if (pathname === "/") {
      return serveFile("./static/index.html");
    }

    // Route: GET /static/* - Serve static files
    if (pathname.startsWith("/static/")) {
      const filePath = "." + pathname;
      return serveFile(filePath);
    }

    // Route: GET /api/images - Return image list
    if (pathname === "/api/images") {
      return new Response(
        JSON.stringify({
          images: imagePaths,
          displayTimeMs: config.displayTimeMs,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Route: GET /images/* - Serve actual images from configured folder
    if (pathname.startsWith("/images/")) {
      const relativePath = pathname.replace("/images/", "");
      const fullPath = `${config.imageFolderPath}/${relativePath}`;
      return serveFile(fullPath);
    }

    return new Response("Not Found", { status: 404 });
  });
}

main();
