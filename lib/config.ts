import { logger } from "./logger.ts";

export interface Config {
  imageFolderPath: string;
  displayTimeMs: number;
  maxDepth: number;
  maxFiles: number;
}

const DEFAULT_CONFIG: Config = {
  imageFolderPath: "/Users/pwv16/b/projects/slideshow/images",
  displayTimeMs: 5000,
  maxDepth: 3,
  maxFiles: 200,
};

export async function loadConfig(configPath = "params.json"): Promise<Config> {
  try {
    const text = await Deno.readTextFile(configPath);
    const parsed = JSON.parse(text);

    const config: Config = {
      imageFolderPath: parsed.imageFolderPath ?? DEFAULT_CONFIG.imageFolderPath,
      displayTimeMs: parsed.displayTimeMs ?? DEFAULT_CONFIG.displayTimeMs,
      maxDepth: parsed.maxDepth ?? DEFAULT_CONFIG.maxDepth,
      maxFiles: parsed.maxFiles ?? DEFAULT_CONFIG.maxFiles,
    };

    // Validate config
    if (typeof config.imageFolderPath !== "string" || config.imageFolderPath.length === 0) {
      throw new Error("imageFolderPath must be a non-empty string");
    }
    if (typeof config.displayTimeMs !== "number" || config.displayTimeMs < 100) {
      throw new Error("displayTimeMs must be a number >= 100");
    }
    if (typeof config.maxDepth !== "number" || config.maxDepth < 1) {
      throw new Error("maxDepth must be a number >= 1");
    }
    if (typeof config.maxFiles !== "number" || config.maxFiles < 1) {
      throw new Error("maxFiles must be a number >= 1");
    }

    logger.info(`Config loaded: imageFolderPath=${config.imageFolderPath}, displayTimeMs=${config.displayTimeMs}, maxDepth=${config.maxDepth}, maxFiles=${config.maxFiles}`);
    return config;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      logger.warn(`Config file not found at ${configPath}, using defaults`);
      return DEFAULT_CONFIG;
    }
    logger.error(`Failed to load config: ${error}`);
    throw error;
  }
}
