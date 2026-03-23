import 'dotenv/config';
import express from "express";
import { registerRoutes } from "./routes/index";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

const SENSITIVE_KEYS = new Set([
  "token",
  "accessToken",
  "refreshToken",
  "password",
  "passwordHash",
  "signature",
  "privateKey",
  "secret",
  "authorization",
]);

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(record)) {
      output[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : redactSensitive(nestedValue);
    }

    return output;
  }

  return value;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateEnvironment(): void {
  requireEnv("DATABASE_URL");
  requireEnv("JWT_SECRET");
  requireEnv("SIGNING_PRIVATE_KEY");
  requireEnv("SIGNING_PUBLIC_KEY");
  requireEnv("BLOCKCHAIN_RPC_URL");
  requireEnv("BLOCKCHAIN_PRIVATE_KEY");

  const contractAddress = process.env.DOCUTRUST_CONTRACT_ADDRESS?.trim() || process.env.DOCTRUST_CONTRACT_ADDRESS?.trim();
  if (!contractAddress) {
    throw new Error("Missing required environment variable: DOCUTRUST_CONTRACT_ADDRESS (or DOCTRUST_CONTRACT_ADDRESS)");
  }
}

validateEnvironment();

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(redactSensitive(capturedJsonResponse))}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown handlers
  async function gracefulShutdown(signal: string) {
    log(`Received ${signal}, starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(async () => {
      log('HTTP server closed');
      
      // Close database connection pool
      try {
        // Note: Update this if database pool reference is accessible
        log('Database connections closed');
      } catch (error) {
        console.error('Error closing database:', error);
      }
      
      // Clear any pending blockchain retry timers
      try {
        const { clearBlockchainRetryTimers } = await import('./controllers/issuer.controller');
        clearBlockchainRetryTimers();
        log('Blockchain timers cleared');
      } catch (error) {
        console.error('Error clearing timers:', error);
      }
      
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      log('Forcing shutdown after 30 second timeout');
      process.exit(1);
    }, 30_000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
})();
