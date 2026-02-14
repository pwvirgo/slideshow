import { logger, LogLevel } from "./lib/logger.ts";
import { loadParams, Params } from "./lib/params.ts";
import { scanImages } from "./lib/scanner.ts";
import { openDb, queryImages, insertAction, getImageInfo, DbImage, QueryResult } from "./lib/db.ts";
import { DatabaseSync } from "node:sqlite";

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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Load images from folder source — returns relative paths (same as before)
async function loadFolderImages(params: Params): Promise<{ imagePaths: string[], dbImages: null }> {
  const images = await scanImages(params);
  const imagePaths = images.map((img) =>
    img.replace(params.imageFolderPath, "").replace(/^\//, "")
  );
  return { imagePaths, dbImages: null };
}

// Result type for DB loading
interface DbLoadResult {
  dbImages: DbImage[];
  db: DatabaseSync | null;
  error: string | null;
  totalFromDb: number;
  skippedMissing: number;
}

// Load images from DB source — returns DbImage[] with ids and absolute paths
function loadDbImages(params: Params): DbLoadResult {
  try {
    const db = openDb(params.dbPath);
    const result = queryImages(db, params.whereClause, params.maxFiles);
    return {
      dbImages: result.images,
      db,
      error: null,
      totalFromDb: result.totalFromDb,
      skippedMissing: result.skippedMissing,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to load database: ${message}`);
    return {
      dbImages: [],
      db: null,
      error: message,
      totalFromDb: 0,
      skippedMissing: 0,
    };
  }
}

async function main(): Promise<void> {
  logger.info("Starting slideshow server...");

  const params = await loadParams();
  logger.setLogLevel(params.logLevel);

  // Load images based on source
  let folderImagePaths: string[] = [];
  let dbImages: DbImage[] = [];
  let db: DatabaseSync | null = null;
  let startupError: string | null = null;
  let dbTotalFromDb = 0;
  let dbSkippedMissing = 0;
  const isDbSource = params.source === "db";

  if (isDbSource) {
    const result = loadDbImages(params);
    dbImages = result.dbImages;
    db = result.db;
    startupError = result.error;
    dbTotalFromDb = result.totalFromDb;
    dbSkippedMissing = result.skippedMissing;
    if (result.error) {
      logger.error(`DB source failed: ${result.error}`);
    } else {
      logger.info(`DB source: ${dbImages.length} images loaded`);
    }
  } else {
    const result = await loadFolderImages(params);
    folderImagePaths = result.imagePaths;
    logger.info(`Folder source: ${folderImagePaths.length} images loaded`);
  }

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
    if (pathname === "/api/params" && request.method === "GET") {
      return jsonResponse({
        source: params.source,
        imageFolderPath: params.imageFolderPath,
        dbPath: params.dbPath,
        whereClause: params.whereClause,
        displayTimeMs: params.displayTimeMs,
        maxDepth: params.maxDepth,
        maxFiles: params.maxFiles,
        logLevel: logger.getLogLevel(),
      });
    }

    // Route: POST /api/params - Save editable params
    // Requires server restart to take effect.
    if (pathname === "/api/params" && request.method === "POST") {
      try {
        const body = await request.json();
        const text = await Deno.readTextFile("params.json");
        const current = JSON.parse(text);

        // Update fields from the form
        if (body.source !== undefined) current.source = body.source;
        if (body.dbPath !== undefined) current.dbPath = body.dbPath;
        if (body.whereClause !== undefined) current.whereClause = body.whereClause;
        if (body.imageFolderPath !== undefined) current.imageFolderPath = body.imageFolderPath;
        if (body.maxDepth !== undefined) current.maxDepth = body.maxDepth;
        if (body.maxFiles !== undefined) current.maxFiles = body.maxFiles;

        await Deno.writeTextFile("params.json", JSON.stringify(current, null, 2) + "\n");
        logger.info(`Params saved: source=${current.source}`);
        return jsonResponse({ ok: true, message: "Saved. Restart server to apply changes." });
      } catch (error) {
        logger.error(`Failed to save params: ${error}`);
        return jsonResponse({ error: "Failed to save params" }, 500);
      }
    }

    // Route: POST /api/logLevel - Change log level at runtime
    if (pathname === "/api/logLevel" && request.method === "POST") {
      const VALID_LEVELS: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];
      try {
        const body = await request.json();
        const level = body.logLevel as LogLevel;
        if (!VALID_LEVELS.includes(level)) {
          return jsonResponse({ error: "Invalid log level" }, 400);
        }
        logger.setLogLevel(level);
        logger.info(`Log level changed to ${level}`);
        return jsonResponse({ logLevel: level });
      } catch {
        return jsonResponse({ error: "Invalid request body" }, 400);
      }
    }

    // Route: GET /api/images - Return image list
    if (pathname === "/api/images") {
      if (isDbSource) {
        // DB mode: return list of {id, index} so frontend can reference by index
        // Images served via /images/<index> which maps to dbImages[index]
        const imageList = dbImages.map((_img, i) => String(i));

        // Build error/warning info for frontend
        let errorInfo: { error: string; suggestion: string } | null = null;
        if (startupError) {
          // Database error (invalid path or SQL error)
          if (startupError.includes("unable to open database")) {
            errorInfo = {
              error: `Cannot open database: ${params.dbPath}`,
              suggestion: "Check that dbPath in params.json points to a valid SQLite file.",
            };
          } else if (startupError.includes("syntax error")) {
            errorInfo = {
              error: `SQL syntax error in WHERE clause`,
              suggestion: `Fix the whereClause in params.json. Current: "${params.whereClause}"`,
            };
          } else {
            errorInfo = {
              error: startupError,
              suggestion: "Check params.json settings and restart the server.",
            };
          }
        } else if (imageList.length === 0 && dbSkippedMissing > 0) {
          // All files missing (volume not mounted)
          errorInfo = {
            error: `All ${dbSkippedMissing} images have missing files`,
            suggestion: "The volume containing the images may not be mounted. Connect the drive and restart the server.",
          };
        } else if (imageList.length === 0 && dbTotalFromDb === 0) {
          // Empty query result
          errorInfo = {
            error: "No images match the WHERE clause",
            suggestion: `Adjust the whereClause in params.json. Current: "${params.whereClause || "(none)"}"`,
          };
        }

        return jsonResponse({
          source: "db",
          images: imageList,
          displayTimeMs: params.displayTimeMs,
          errorInfo,
        });
      } else {
        // Folder mode: same as before
        const folderParam = url.searchParams.get("folder");
        let filteredImages = folderImagePaths;

        if (folderParam) {
          const normalizedFolder = folderParam.replace(/^\/+|\/+$/g, "");
          filteredImages = folderImagePaths.filter((img) =>
            img.startsWith(normalizedFolder + "/") || img.startsWith(normalizedFolder)
          );
        }

        return jsonResponse({
          source: "folder",
          images: filteredImages,
          displayTimeMs: params.displayTimeMs,
        });
      }
    }

    // Route: GET /api/imageInfo/<index> - Return metadata for current image (DB mode)
    if (isDbSource && pathname.startsWith("/api/imageInfo/")) {
      const index = parseInt(pathname.replace("/api/imageInfo/", ""));
      if (isNaN(index) || index < 0 || index >= dbImages.length) {
        return jsonResponse({ error: "Invalid image index" }, 400);
      }
      const img = dbImages[index];
      const info = db ? getImageInfo(db, img.id) : null;
      return jsonResponse({
        id: img.id,
        name: img.name,
        path: img.fullPath,
        dtCreated: info?.dtCreated || null,
      });
    }

    // Route: POST /api/actions - Record an action on an image (DB mode)
    if (isDbSource && pathname === "/api/actions" && request.method === "POST") {
      if (!db) {
        return jsonResponse({ error: "Database not available" }, 500);
      }
      try {
        const body = await request.json();
        const { fotoId, act, note } = body;
        if (typeof fotoId !== "number" || typeof act !== "string") {
          return jsonResponse({ error: "fotoId (number) and act (string) required" }, 400);
        }
        insertAction(db, fotoId, act, note ?? "");
        return jsonResponse({ ok: true });
      } catch {
        return jsonResponse({ error: "Invalid request body" }, 400);
      }
    }

    // Route: GET /images/* - Serve actual image files
    if (pathname.startsWith("/images/")) {
      if (isDbSource) {
        // DB mode: /images/<index> maps to dbImages[index].fullPath
        const index = parseInt(pathname.replace("/images/", ""));
        if (isNaN(index) || index < 0 || index >= dbImages.length) {
          return new Response("Not Found", { status: 404 });
        }
        return serveFile(dbImages[index].fullPath);
      } else {
        // Folder mode: /images/<relative-path> under imageFolderPath
        const relativePath = pathname.replace("/images/", "");
        const fullPath = `${params.imageFolderPath}/${relativePath}`;
        return serveFile(fullPath);
      }
    }

    return new Response("Not Found", { status: 404 });
  });
}

main();
