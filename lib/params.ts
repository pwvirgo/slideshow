import { logger, LogLevel } from "./logger.ts";

export type Source = "folder" | "db";

export interface Params {
  source: Source;
  imageFolderPath: string;
  dataDir: string;
  dbName: string;
  trashDir: string;
  whereClause: string;
  orderBy: string;
  displayTimeMs: number;
  maxDepth: number;
  maxFiles: number;
  logLevel: LogLevel;
}

const DEFAULT_PARAMS: Params = {
  source: "folder",
  imageFolderPath: "/Users/m4book/a/projects/fotos/images",
  dataDir: "../photos",
  dbName: "photos3.db",
  trashDir: "../photos/trash",
  whereClause: "",
  orderBy: "",
  displayTimeMs: 5000,
  maxDepth: 3,
  maxFiles: 200,
  logLevel: "INFO",
};

// Full path to the SQLite file. Relative dataDir resolves from the project root.
export function dbFile(params: Params): string {
  return `${params.dataDir.replace(/\/+$/, "")}/${params.dbName}`;
}

export async function loadParams(paramsPath = "params.json"): Promise<Params> {
  try {
    const text = await Deno.readTextFile(paramsPath);
    const parsed = JSON.parse(text);

    const params: Params = {
      source: parsed.source ?? DEFAULT_PARAMS.source,
      imageFolderPath: parsed.imageFolderPath ?? DEFAULT_PARAMS.imageFolderPath,
      dataDir: parsed.dataDir ?? DEFAULT_PARAMS.dataDir,
      dbName: parsed.dbName ?? DEFAULT_PARAMS.dbName,
      trashDir: parsed.trashDir ?? "",
      whereClause: parsed.whereClause ?? DEFAULT_PARAMS.whereClause,
      orderBy: parsed.orderBy ?? DEFAULT_PARAMS.orderBy,
      displayTimeMs: parsed.displayTimeMs ?? DEFAULT_PARAMS.displayTimeMs,
      maxDepth: parsed.maxDepth ?? DEFAULT_PARAMS.maxDepth,
      maxFiles: parsed.maxFiles ?? DEFAULT_PARAMS.maxFiles,
      logLevel: parsed.logLevel ?? DEFAULT_PARAMS.logLevel,
    };

    // dbPath (full path to the db file) was replaced by dataDir + dbName.
    // Split an old value rather than silently misreading it as a folder.
    if (parsed.dbPath !== undefined && parsed.dataDir === undefined && parsed.dbName === undefined) {
      const slash = String(parsed.dbPath).lastIndexOf("/");
      params.dataDir = slash >= 0 ? parsed.dbPath.slice(0, slash) : ".";
      params.dbName = parsed.dbPath.slice(slash + 1);
      logger.warn(`params.json: "dbPath" is obsolete — using dataDir="${params.dataDir}", dbName="${params.dbName}". Replace it with those two keys.`);
    } else if (parsed.dbPath !== undefined) {
      logger.warn(`params.json: obsolete "dbPath" ignored — dataDir/dbName are used instead.`);
    }
    if (!params.trashDir) params.trashDir = `${params.dataDir}/trash`;

    // Validate params
    if (params.source !== "folder" && params.source !== "db") {
      throw new Error('source must be "folder" or "db"');
    }
    if (params.source === "folder" && (typeof params.imageFolderPath !== "string" || params.imageFolderPath.length === 0)) {
      throw new Error("imageFolderPath must be a non-empty string");
    }
    for (const key of ["dataDir", "dbName", "trashDir"] as const) {
      if (typeof params[key] !== "string" || params[key].length === 0) {
        throw new Error(`${key} must be a non-empty string`);
      }
    }
    if (params.dbName.includes("/")) {
      throw new Error("dbName must be a file name only — put the folder in dataDir");
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

    logger.debug(`Params loaded: source=${params.source}, db=${dbFile(params)}, trashDir=${params.trashDir}`);
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
