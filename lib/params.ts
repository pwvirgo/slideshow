import { logger, LogLevel } from "./logger.ts";

export type Source = "folder" | "db";

export interface Params {
  source: Source;
  imageFolderPath: string;
  dbPath: string;
  whereClause: string;
  displayTimeMs: number;
  maxDepth: number;
  maxFiles: number;
  logLevel: LogLevel;
}

const DEFAULT_PARAMS: Params = {
  source: "folder",
  imageFolderPath: "/Users/m4book/a/projects/fotos/images",
  dbPath: "../db/fotos.db",
  whereClause: "",
  displayTimeMs: 5000,
  maxDepth: 3,
  maxFiles: 200,
  logLevel: "INFO",
};

export async function loadParams(paramsPath = "params.json"): Promise<Params> {
  try {
    const text = await Deno.readTextFile(paramsPath);
    const parsed = JSON.parse(text);

    const params: Params = {
      source: parsed.source ?? DEFAULT_PARAMS.source,
      imageFolderPath: parsed.imageFolderPath ?? DEFAULT_PARAMS.imageFolderPath,
      dbPath: parsed.dbPath ?? DEFAULT_PARAMS.dbPath,
      whereClause: parsed.whereClause ?? DEFAULT_PARAMS.whereClause,
      displayTimeMs: parsed.displayTimeMs ?? DEFAULT_PARAMS.displayTimeMs,
      maxDepth: parsed.maxDepth ?? DEFAULT_PARAMS.maxDepth,
      maxFiles: parsed.maxFiles ?? DEFAULT_PARAMS.maxFiles,
      logLevel: parsed.logLevel ?? DEFAULT_PARAMS.logLevel,
    };

    // Validate params
    if (params.source !== "folder" && params.source !== "db") {
      throw new Error('source must be "folder" or "db"');
    }
    if (typeof params.imageFolderPath !== "string" || params.imageFolderPath.length === 0) {
      throw new Error("imageFolderPath must be a non-empty string");
    }
    if (typeof params.dbPath !== "string" || params.dbPath.length === 0) {
      throw new Error("dbPath must be a non-empty string");
    }
    if (typeof params.displayTimeMs !== "number" || params.displayTimeMs < 100) {
      throw new Error("displayTimeMs must be a number >= 100");
    }
    if (typeof params.maxDepth !== "number" || params.maxDepth < 1) {
      throw new Error("maxDepth must be a number >= 1");
    }
    if (typeof params.maxFiles !== "number" || params.maxFiles < 1) {
      throw new Error("maxFiles must be a number >= 1");
    }

    logger.info(`Params loaded: source=${params.source}, displayTimeMs=${params.displayTimeMs}`);
    return params;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      logger.warn(`Params file not found at ${paramsPath}, using defaults`);
      return DEFAULT_PARAMS;
    }
    logger.error(`Failed to load params: ${error}`);
    throw error;
  }
}
