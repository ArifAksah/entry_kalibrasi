/**
 * WhatsApp message builder functions.
 * All functions return plain text — no HTML, no Markdown, no WhatsApp rich text markers (*, _, ~, `).
 */

/**
 * Builds the account confirmation WhatsApp message for a newly registered personnel.
 *
 * @param personnelName - The name of the registered personnel
 * @returns Plain text message confirming account creation
 */
export function buildAccountConfirmationMessage(personnelName: string): string {
  return `Halo ${personnelName},\n\nAkun Anda telah berhasil dibuat di Sistem Kalibrasi BMKG.\n\nTerima kasih.`;
}

/**
 * Builds the certificate completion WhatsApp message sent to the penandatangan (signer).
 *
 * @param certificateNumber - The certificate number (no_certificate)
 * @param completionDateTime - The formatted completion date and time string
 * @returns Plain text message notifying certificate issuance
 */
export function buildCertificateCompletionMessage(
  certificateNumber: string,
  completionDateTime: string
): string {
  return `Sertifikat Terbit\n\nSertifikat dengan nomor ${certificateNumber} telah selesai ditandatangani pada ${completionDateTime}.\n\nTerima kasih.`;
}

/**
 * Builds the draft submission WhatsApp message sent to verifiers.
 *
 * @param certificateNumber - The certificate number (no_certificate)
 * @param calibratorName - The name of the calibrator who submitted the draft
 * @returns Plain text message notifying verifiers of a pending verification task
 */
export function buildDraftSubmissionMessage(
  certificateNumber: string,
  calibratorName: string
): string {
  return `Pemberitahuan Verifikasi\n\nSertifikat ${certificateNumber} telah dikirim untuk verifikasi oleh ${calibratorName}.\n\nMohon segera ditindaklanjuti.\n\nTerima kasih.`;
}
