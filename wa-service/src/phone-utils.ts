/**
 * Phone number normalization utility for WhatsApp JID formatting.
 *
 * Handles Indonesian phone number formats:
 * - Leading "0" → replaced with "62"
 * - Leading "+62" → "+" removed
 * - Leading "62" → used as-is
 *
 * Validates digit count is 10–15 after normalization.
 * Appends "@s.whatsapp.net" to produce a WhatsApp JID.
 */

export interface PhoneNormalizationResult {
  valid: boolean;
  normalized?: string; // "62xxxxxxxxxx@s.whatsapp.net"
  error?: string;
}

export function normalizePhoneNumber(phone: string): PhoneNormalizationResult {
  if (!phone || typeof phone !== "string") {
    return { valid: false, error: "Phone number is required" };
  }

  // Remove all whitespace and dashes for flexibility
  let cleaned = phone.replace(/[\s\-]/g, "");

  // Apply normalization rules
  if (cleaned.startsWith("+62")) {
    // Remove leading "+"
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith("0")) {
    // Replace leading "0" with "62"
    cleaned = "62" + cleaned.slice(1);
  }
  // If it already starts with "62", use as-is (no transformation needed)

  // Validate that the result contains only digits
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: "Invalid phone number format" };
  }

  // Validate digit count is 10–15
  if (cleaned.length < 10 || cleaned.length > 15) {
    return { valid: false, error: "Invalid phone number format" };
  }

  // Append WhatsApp JID suffix
  const jid = `${cleaned}@s.whatsapp.net`;

  return { valid: true, normalized: jid };
}
