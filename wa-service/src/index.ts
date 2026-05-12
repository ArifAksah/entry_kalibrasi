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

async function main() {
  const client = new BaileysClientManager();
  await client.initialize();

  const app = express();

  // CORS — allow Next.js app (port 3000) to access WA service
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json());
  app.use(createRoutes(client));

  app.listen(PORT, () => {
    console.log(`[WA] Service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[WA] Failed to start service:", err);
  process.exit(1);
});
