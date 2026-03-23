/**
 * Structured logging service for the backend.
 * Provides consistent, machine-readable log output with context.
 */

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
type LogContext = Record<string, unknown>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
  context?: LogContext;
}

/**
 * Formats a log entry as JSON for structured logging.
 */
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify({
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
    source: entry.source,
    ...(entry.context && Object.keys(entry.context).length > 0 && { context: entry.context }),
  });
}

/**
 * Get ISO timestamp string
 */
function getISOTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Logger class for structured logging with support for different log levels.
 */
export class Logger {
  constructor(private source: string = "app") {}

  debug(message: string, context?: LogContext): void {
    this.log("DEBUG", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("INFO", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("WARN", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log("ERROR", message, context);
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: getISOTimestamp(),
      level,
      message,
      source: this.source,
      context,
    };

    // Use console methods appropriate to the level
    switch (level) {
      case "DEBUG":
        console.debug(formatLogEntry(entry));
        break;
      case "INFO":
        console.log(formatLogEntry(entry));
        break;
      case "WARN":
        console.warn(formatLogEntry(entry));
        break;
      case "ERROR":
        console.error(formatLogEntry(entry));
        break;
    }
  }
}

/**
 * Create a logger instance for a specific source/module.
 */
export function createLogger(source: string): Logger {
  return new Logger(source);
}

// Export a default logger instance
export const logger = createLogger("main");
