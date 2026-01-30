import { logger } from "./lib/logger.ts";
import { loadParams, Params } from "./lib/params.ts";
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
      headers: {
        "Content-Type": getMimeType(path),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
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

  const params = await loadParams();
  const images = await scanImages(params);

  // Convert absolute paths to relative paths for the API
  const imagePaths = images.map((img) => {
    // Return path relative to the image folder
    return img.replace(params.imageFolderPath, "").replace(/^\//, "");
  });

  logger.info(`Server starting on http://localhost:${PORT}`);

  Deno.serve({ port: PORT }, async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    logger.debug(`${request.method} ${pathname}`);

    // Route: GET / or /slides - Serve slides.html (slideshow viewer)
    if (pathname === "/" || pathname === "/slides" || pathname === "/slides.html") {
      return serveFile("./static/slides.html");
    }

    // Route: GET /params - Serve params.html (params page)
    if (pathname === "/params" || pathname === "/params.html") {
      return serveFile("./static/params.html");
    }

    // Route: GET /static/* - Serve static files
    if (pathname.startsWith("/static/")) {
      const filePath = "." + pathname;
      return serveFile(filePath);
    }

    // Route: GET /api/params - Return current parameters
    if (pathname === "/api/params") {
      return new Response(
        JSON.stringify({
          imageFolderPath: params.imageFolderPath,
          displayTimeMs: params.displayTimeMs,
          maxDepth: params.maxDepth,
          maxFiles: params.maxFiles,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Route: GET /api/images - Return image list
    // Optional query param: folder - filter to images within this subfolder
    if (pathname === "/api/images") {
      const folderParam = url.searchParams.get("folder");
      let filteredImages = imagePaths;

      if (folderParam) {
        // Normalize folder param (remove leading/trailing slashes)
        const normalizedFolder = folderParam.replace(/^\/+|\/+$/g, "");
        filteredImages = imagePaths.filter((img) =>
          img.startsWith(normalizedFolder + "/") || img.startsWith(normalizedFolder)
        );
      }

      return new Response(
        JSON.stringify({
          images: filteredImages,
          displayTimeMs: params.displayTimeMs,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Route: GET /images/* - Serve actual images from configured folder
    if (pathname.startsWith("/images/")) {
      const relativePath = pathname.replace("/images/", "");
      const fullPath = `${params.imageFolderPath}/${relativePath}`;
      return serveFile(fullPath);
    }

    return new Response("Not Found", { status: 404 });
  });
}

main();
