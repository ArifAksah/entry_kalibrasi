export interface SendWhatsAppParams {
  phone: string;
  message: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  error?: string;
}

/**
 * Sends a WhatsApp message via the WA Service HTTP API.
 * Mirrors the lib/brevo.ts pattern — never throws, always returns a result object.
 *
 * Uses the WA_SERVICE_URL environment variable to locate the WA service.
 * Fire-and-forget usage: `void sendWhatsApp({ phone, message })`
 */
export async function sendWhatsApp(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  try {
    const waServiceUrl = process.env.WA_SERVICE_URL;
    if (!waServiceUrl || !waServiceUrl.trim()) {
      return { success: false, error: 'Missing WA_SERVICE_URL configuration' };
    }

    const response = await fetch(`${waServiceUrl.trim()}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: params.phone,
        message: params.message,
      }),
    });

    if (!response.ok) {
      let errorMessage = `WA service returned HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body && body.error) {
          errorMessage = body.error;
        }
      } catch {
        // Ignore JSON parse errors — use the status-based message
      }
      console.error(`Failed to send WhatsApp to ${params.phone}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to send WhatsApp to ${params.phone}: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}
