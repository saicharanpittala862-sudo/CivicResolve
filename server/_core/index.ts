
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { sqlite } from "../db";
import { appRouter } from "../routers";
import { sweepSla } from "../sla";
import { seedCatalog } from "../catalog";
import { registerStorageProxy } from "./storageProxy";
import { createContext } from "./trpc";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  if (process.env.TRUST_PROXY) {
    app.set(
      "trust proxy",
      Number(process.env.TRUST_PROXY) || 1
    );
  }

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "img-src": ["'self'", "data:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "font-src": ["'self'", "data:"],
          "frame-ancestors": ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(cookieParser());

  // Database health check
  app.get("/healthz", (_req, res) => {
    try {
      sqlite.prepare("SELECT 1").get();
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({
        status: "database unavailable",
      });
    }
  });

  // Allowed frontend origins.
  // Override ALLOWED_ORIGINS in the environment when necessary.
  const allowedOrigins = new Set(
    (
      process.env.ALLOWED_ORIGINS ??
      "http://localhost:5173,http://127.0.0.1:5173"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          throw new Error(
            `Invalid origin in ALLOWED_ORIGINS: ${origin}`
          );
        }
      })
  );

  // Temporary diagnostic: remove after troubleshooting.
  console.log(
    "Allowed frontend origins:",
    [...allowedOrigins]
  );

  // Protect state-changing API requests from untrusted origins.
  app.use("/api", (req, res, next) => {
    const origin = req.headers.origin;

    // Temporary diagnostics: do not log cookies or request bodies.
    console.log("Request origin:", origin);
    console.log(
      "Request method:",
      req.method,
      "URL:",
      req.originalUrl
    );

    if (req.method !== "GET" && origin) {
      let requestOrigin: string;

      try {
        requestOrigin = new URL(origin).origin;
      } catch {
        return res.status(403).json({
          error: "Invalid request origin",
        });
      }

      if (!allowedOrigins.has(requestOrigin)) {
        console.error("Blocked request origin:", requestOrigin);

        return res.status(403).json({
          error: "Cross-origin request blocked",
        });
      }
    }

    next();
  });

  // General API rate limiting
  const limiter = (windowMs: number, limit: number) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "Too many requests. Try again later.",
      },
    });

  app.use("/api", limiter(15 * 60_000, 600));

  // Login rate limiting
  app.use(
    "/api/trpc/auth.internalLogin",
    limiter(15 * 60_000, 20)
  );

  // Public mutation rate limiting
  app.use(
    [
      "/api/trpc/portal.create",
      "/api/trpc/portal.uploadAttachment",
      "/api/trpc/portal.feedback",
      "/api/trpc/portal.reopen",
      "/api/trpc/portal.checkAccess",
    ],
    limiter(15 * 60_000, 25)
  );

  // Storage proxy routes
  registerStorageProxy(app);

  // tRPC API
  app.use(
    "/api/trpc",
    express.json({ limit: "4mb" }),
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Unknown API routes
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Frontend static files
  const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../dist/public"
  );

  app.use(
    express.static(dist, {
      index: false,
      maxAge: "1h",
    })
  );

  // Frontend fallback
  app.get("*", (_req, res) => {
    res.sendFile(
      path.join(dist, "index.html"),
      (err) => {
        if (err) {
          res
            .status(404)
            .send("Frontend not built. Run npm run build.");
        }
      }
    );
  });

  return app;
}

// Start the server when this file is executed directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedCatalog();

  const port = Number(process.env.PORT ?? 3000);

  createApp().listen(port, () => {
    console.log(`CivicResolve listening on :${port}`);
  });

  setInterval(() => {
    try {
      sweepSla();
    } catch (error) {
      console.error("SLA sweep failed", error);
    }
  }, 15 * 60_000).unref();
}
