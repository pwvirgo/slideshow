const LOG_FILE = "slideshow.log";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

async function writeToFile(message: string): Promise<void> {
  try {
    await Deno.writeTextFile(LOG_FILE, message + "\n", { append: true });
  } catch (error) {
    console.error("Failed to write to log file:", error);
  }
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

export function info(message: string): void {
  const formatted = formatMessage("INFO", message);
  console.log(formatted);
  writeToFile(formatted);
}

export function warn(message: string): void {
  const formatted = formatMessage("WARN", message);
  console.warn(formatted);
  writeToFile(formatted);
}

export function error(message: string): void {
  const formatted = formatMessage("ERROR", message);
  console.error(formatted);
  writeToFile(formatted);
}

export function debug(message: string): void {
  const formatted = formatMessage("DEBUG", message);
  console.log(formatted);
  writeToFile(formatted);
}

export const logger = { info, warn, error, debug };
