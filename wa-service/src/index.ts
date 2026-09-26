/**
 * WA Service entry point.
 *
 * Loads environment variables, initializes the Baileys client,
 * and starts the Express HTTP server with CORS support.
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { BaileysClientManager } from "./baileys-client.js";
import { createRoutes } from "./routes.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.WA_HOST || "127.0.0.1";
const SERVICE_TOKEN = (process.env.WA_SERVICE_TOKEN || "").trim();

// CORS whitelist. Never fall back to '*': the WA service can send messages and
// expose the pairing QR, so only known origins may reach it.
const ALLOWED_ORIGINS = (process.env.WA_ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function corsOrigin(origin?: string): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Same-origin/server-to-server calls send no Origin header.
  return null;
}

async function main() {
  if (!SERVICE_TOKEN) {
    console.warn(
      "[WA] WA_SERVICE_TOKEN is not set. All requests will be rejected until it is configured.",
    );
  }

  const client = new BaileysClientManager();
  await client.initialize();

  const app = express();

  // Security headers: no caching of QR/status responses.
  app.use((_req, res, next) => {
    res.header("X-Content-Type-Options", "nosniff");
    res.header("Cache-Control", "no-store");
    next();
  });

  app.use((req, res, next) => {
    const origin = req.header("origin") || undefined;
    const allowed = corsOrigin(origin);
    if (allowed) {
      res.header("Access-Control-Allow-Origin", allowed);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, x-wa-token");
    }
    // Reject cross-origin requests that are not explicitly whitelisted.
    if (origin && !allowed) {
      res.status(403).json({ success: false, error: "Origin not allowed" });
      return;
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Shared-secret gate. Requires WA_SERVICE_TOKEN on every route; the Next.js
  // server proxies UI requests with this header so the token never reaches the
  // browser.
  app.use((req, res, next) => {
    if (!SERVICE_TOKEN) {
      res.status(503).json({ success: false, error: "WA service token not configured" });
      return;
    }
    const provided = req.header("x-wa-token");
    if (!provided || provided !== SERVICE_TOKEN) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    next();
  });

  app.use(express.json({ limit: "256kb" }));
  app.use(createRoutes(client));

  app.listen(PORT, HOST, () => {
    console.log(`[WA] Service listening on ${HOST}:${PORT}`);
    if (ALLOWED_ORIGINS.length > 0) {
      console.log(`[WA] CORS whitelist: ${ALLOWED_ORIGINS.join(", ")}`);
    }
  });
}

main().catch((err) => {
  console.error("[WA] Failed to start service:", err);
  process.exit(1);
});
