/**
 * Express HTTP route handlers for the WA Service.
 *
 * Endpoints:
 * - POST /send-message: Send a WhatsApp message
 * - GET /status: Connection status + QR availability
 * - GET /qr: Get current QR code string for web display
 * - POST /logout: Disconnect and clear session
 */

import { Router, Request, Response } from "express";
import { BaileysClientManager } from "./baileys-client.js";
import { normalizePhoneNumber } from "./phone-utils.js";

export function createRoutes(client: BaileysClientManager): Router {
  const router = Router();

  /**
   * POST /send-message
   * Body: { phone: string, message: string }
   */
  router.post("/send-message", async (req: Request, res: Response) => {
    const { phone, message } = req.body;

    if (!phone || typeof phone !== "string" || phone.trim() === "") {
      res.status(400).json({ success: false, error: "Phone number is required" });
      return;
    }

    if (!message || typeof message !== "string" || message.trim() === "") {
      res.status(400).json({ success: false, error: "Message is required" });
      return;
    }

    const normResult = normalizePhoneNumber(phone);
    if (!normResult.valid) {
      res.status(400).json({ success: false, error: normResult.error });
      return;
    }

    if (!client.isConnected()) {
      res.status(503).json({ success: false, error: "WhatsApp not connected" });
      return;
    }

    try {
      await client.sendMessage(normResult.normalized!, message);
      res.status(200).json({ success: true });
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown error";
      console.error("[WA] Failed to send message:", errorMessage);
      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  /**
   * GET /status
   * Returns: { connected: boolean, hasQR: boolean }
   */
  router.get("/status", (_req: Request, res: Response) => {
    res.status(200).json({
      connected: client.isConnected(),
      hasQR: client.getQR() !== null,
    });
  });

  /**
   * GET /qr
   * Returns: { qr: string | null }
   * The QR string can be rendered as a QR code image on the frontend.
   */
  router.get("/qr", (_req: Request, res: Response) => {
    const qr = client.getQR();
    res.status(200).json({ qr });
  });

  /**
   * POST /logout
   * Disconnects the WhatsApp session.
   */
  router.post("/logout", async (_req: Request, res: Response) => {
    try {
      await client.logout();
      res.status(200).json({ success: true, message: "Logged out" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || "Logout failed" });
    }
  });

  return router;
}
