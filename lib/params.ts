import { logger } from "./logger.ts";

export interface Params {
  imageFolderPath: string;
  displayTimeMs: number;
  maxDepth: number;
  maxFiles: number;
}

const DEFAULT_PARAMS: Params = {
  imageFolderPath: "/Users/pwv16/b/projects/slideshow/images",
  displayTimeMs: 5000,
  maxDepth: 3,
  maxFiles: 200,
};

export async function loadParams(paramsPath = "params.json"): Promise<Params> {
  try {
    const text = await Deno.readTextFile(paramsPath);
    const parsed = JSON.parse(text);

    const params: Params = {
      imageFolderPath: parsed.imageFolderPath ?? DEFAULT_PARAMS.imageFolderPath,
      displayTimeMs: parsed.displayTimeMs ?? DEFAULT_PARAMS.displayTimeMs,
      maxDepth: parsed.maxDepth ?? DEFAULT_PARAMS.maxDepth,
      maxFiles: parsed.maxFiles ?? DEFAULT_PARAMS.maxFiles,
    };

    // Validate params
    if (typeof params.imageFolderPath !== "string" || params.imageFolderPath.length === 0) {
      throw new Error("imageFolderPath must be a non-empty string");
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

    logger.info(`Params loaded: imageFolderPath=${params.imageFolderPath}, displayTimeMs=${params.displayTimeMs}, maxDepth=${params.maxDepth}, maxFiles=${params.maxFiles}`);
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
