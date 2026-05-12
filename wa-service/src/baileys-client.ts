/**
 * Baileys WhatsApp client manager.
 *
 * Manages the WhatsApp Web connection lifecycle:
 * - Session persistence via multi-file auth state
 * - QR code storage for web-based pairing
 * - Auto-reconnect on non-logout disconnections (with delay)
 * - Credential updates persisted to disk
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, "../auth_info");

const logger = pino({ level: "silent" });

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 5000;

export class BaileysClientManager {
  private socket: WASocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private currentQR: string | null = null;

  async initialize(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    this.socket = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: true,
    });

    this.socket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.currentQR = qr;
        console.log("[WA] 📱 QR code ready — scan from admin dashboard or terminal");
      }

      if (connection === "open") {
        this.connected = true;
        this.currentQR = null; // Clear QR once connected
        this.reconnectAttempts = 0;
        console.log("[WA] ✅ Connected to WhatsApp");
      }

      if (connection === "close") {
        this.connected = false;
        this.currentQR = null;

        const error = lastDisconnect?.error as Boom | undefined;
        const statusCode = error?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          console.log("[WA] ❌ Logged out. Delete auth_info/ folder and restart to re-pair.");
          return;
        }

        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log(`[WA] ❌ Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`);
          return;
        }

        this.reconnectAttempts++;
        console.log(`[WA] Reconnecting in ${RECONNECT_DELAY_MS / 1000}s... (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

        setTimeout(() => {
          this.initialize();
        }, RECONNECT_DELAY_MS);
      }
    });

    this.socket.ev.on("creds.update", saveCreds);
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Returns the current QR code string (for web display), or null if not available.
   */
  getQR(): string | null {
    return this.currentQR;
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Baileys client not initialized");
    }
    await this.socket.sendMessage(jid, { text });
  }

  /**
   * Disconnect and clear session for re-pairing.
   */
  async logout(): Promise<void> {
    if (this.socket) {
      await this.socket.logout();
    }
    this.connected = false;
    this.currentQR = null;
  }
}
