import { BrevoClient } from '@getbrevo/brevo';

export interface SendEmailParams {
  to: string;          // Recipient email address
  subject: string;     // Email subject (max 150 chars, truncated if exceeded)
  htmlContent: string; // HTML body (max 1 MB)
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;  // Present on success
  error?: string;      // Present on failure
}

const MAX_SUBJECT_LENGTH = 150;
const MAX_HTML_CONTENT_BYTES = 1_048_576; // 1 MB

const SENDER_EMAIL = 'noreplysimkalnmkg@gmail.com';
const SENDER_NAME = 'BMKG Sistem Kalibrasi';

/**
 * Validates that the given string is a valid email format.
 * Checks: non-empty, contains @, has domain part with at least one dot.
 */
function isValidEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex < 1) return false; // no @ or @ at start
  const domain = trimmed.slice(atIndex + 1);
  if (!domain || domain.length === 0) return false;
  if (!domain.includes('.')) return false;
  // Check domain doesn't start/end with dot and has content after dot
  const parts = domain.split('.');
  if (parts.some((part) => part.length === 0)) return false;
  return true;
}

/**
 * Sends a transactional email via Brevo API.
 * Validates inputs before calling the API.
 * Never throws — always returns a result object.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    // Validate BREVO_API_KEY
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'Missing BREVO_API_KEY configuration' };
    }

    // Validate recipient email
    if (!isValidEmail(params.to)) {
      return { success: false, error: 'Invalid recipient email address' };
    }

    // Validate htmlContent size (1 MB max)
    const contentBytes = new TextEncoder().encode(params.htmlContent).length;
    if (contentBytes > MAX_HTML_CONTENT_BYTES) {
      return { success: false, error: 'Email body exceeds maximum size' };
    }

    // Truncate subject if exceeded
    const subject = params.subject.length > MAX_SUBJECT_LENGTH
      ? params.subject.slice(0, MAX_SUBJECT_LENGTH)
      : params.subject;

    // Configure Brevo client
    const client = new BrevoClient({
      apiKey,
    });

    // Send transactional email
    const response = await client.transactionalEmails.sendTransacEmail({
      sender: {
        email: SENDER_EMAIL,
        name: SENDER_NAME,
      },
      to: [{ email: params.to.trim() }],
      subject,
      htmlContent: params.htmlContent,
    });

    return {
      success: true,
      messageId: response.messageId || undefined,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to send email to ${params.to}: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}
