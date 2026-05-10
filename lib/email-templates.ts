/**
 * Email template builders for the BMKG Calibration System.
 * All templates use inline CSS only (no <style> or <link rel="stylesheet"> tags)
 * to ensure compatibility across Gmail, Outlook, and Yahoo Mail.
 */

/**
 * Wraps content HTML in the shared BMKG email template structure.
 * Header: gradient background with "BMKG - Sistem Kalibrasi" and subtitle "Direktorat Data dan Komputasi"
 * Footer: "© 2025 BMKG - Direktorat Data dan Komputasi"
 * All CSS is inline.
 */
export function wrapInEmailTemplate(contentHtml: string): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e293b, #1e40af); padding: 30px; border-radius: 10px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">BMKG - Sistem Kalibrasi</h1>
    <p style="color: #cbd5e1; margin: 10px 0 0 0;">Direktorat Data dan Komputasi</p>
  </div>
  <div style="background: white; padding: 30px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    ${contentHtml}
  </div>
  <div style="text-align: center; margin-top: 20px;">
    <p style="color: #64748b; font-size: 12px;">\u00a9 2025 BMKG - Direktorat Data dan Komputasi</p>
  </div>
</div>`;
}

/**
 * Builds the account confirmation email HTML body.
 * Includes the user's name in the greeting and BMKG branding.
 */
export function buildAccountConfirmationHtml(params: {
  userName: string;
}): string {
  const { userName } = params;

  const contentHtml = `<h2 style="color: #1e293b; margin-top: 0;">Konfirmasi Akun</h2>
    <p style="color: #64748b; line-height: 1.6;">
      Halo <strong>${userName}</strong>,
    </p>
    <p style="color: #64748b; line-height: 1.6;">
      Selamat! Akun Anda pada Sistem Kalibrasi BMKG telah berhasil dibuat.
    </p>
    <p style="color: #64748b; line-height: 1.6;">
      Anda sekarang dapat menggunakan akun ini untuk mengakses layanan kalibrasi yang tersedia di sistem kami.
    </p>
    <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="color: #0369a1; margin: 0; font-size: 14px;">
        <strong>Informasi:</strong> Jika Anda tidak merasa mendaftar pada sistem ini, silakan abaikan email ini atau hubungi administrator.
      </p>
    </div>`;

  return wrapInEmailTemplate(contentHtml);
}

/**
 * Builds the signer notification email HTML body.
 * Includes certificate number, completion date/time, and a link to view the certificate.
 */
export function buildSignerNotificationHtml(params: {
  certificateNumber: string;
  completionDateTime: string;
  viewUrl: string;
}): string {
  const { certificateNumber, completionDateTime, viewUrl } = params;

  const contentHtml = `<h2 style="color: #1e293b; margin-top: 0;">Sertifikat Terbit</h2>
    <p style="color: #64748b; line-height: 1.6;">
      Sertifikat yang Anda tandatangani telah selesai diproses dan resmi terbit.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <p style="background: #f1f5f9; color: #1e293b; padding: 12px 30px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 18px;">
        ${certificateNumber}
      </p>
    </div>
    <p style="color: #64748b; line-height: 1.6;">
      <strong>Waktu penyelesaian:</strong> ${completionDateTime}
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${viewUrl}" style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Lihat Sertifikat
      </a>
    </div>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
    <p style="color: #64748b; font-size: 12px; line-height: 1.6;">
      <strong>Catatan:</strong><br>
      Jika Anda memiliki pertanyaan terkait sertifikat ini, silakan hubungi administrator sistem.
    </p>`;

  return wrapInEmailTemplate(contentHtml);
}


/**
 * Builds the password reset email HTML body.
 * Includes a reset link button and expiry information.
 */
export function buildPasswordResetHtml(params: {
  resetUrl: string;
}): string {
  const { resetUrl } = params;

  const contentHtml = `<h2 style="color: #1e293b; margin-top: 0;">Reset Password</h2>
    <p style="color: #64748b; line-height: 1.6;">
      Anda menerima email ini karena ada permintaan untuk mereset password akun Anda.
    </p>
    <p style="color: #64748b; line-height: 1.6;">
      Klik tombol di bawah ini untuk mengatur ulang password Anda:
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Reset Password
      </a>
    </div>
    <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
      Jika tombol tidak berfungsi, salin dan tempel link berikut ke browser Anda:<br>
      <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
    </p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
    <p style="color: #64748b; font-size: 12px; line-height: 1.6;">
      <strong>Catatan:</strong><br>
      &bull; Link ini berlaku selama 1 jam<br>
      &bull; Jika Anda tidak meminta reset password, abaikan email ini<br>
      &bull; Password Anda tidak akan berubah sampai Anda mengklik link di atas
    </p>`;

  return wrapInEmailTemplate(contentHtml);
}

/**
 * Builds the password reset confirmation email HTML body.
 * Sent after password has been successfully changed.
 */
export function buildPasswordResetConfirmationHtml(): string {
  const contentHtml = `<h2 style="color: #1e293b; margin-top: 0;">Password Berhasil Diperbarui</h2>
    <p style="color: #64748b; line-height: 1.6;">
      Password akun Anda telah berhasil diperbarui pada ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.
    </p>
    <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="color: #0369a1; margin: 0; font-size: 14px;">
        <strong>Keamanan:</strong> Jika Anda tidak melakukan perubahan ini, segera hubungi administrator sistem.
      </p>
    </div>
    <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
      Anda sekarang dapat menggunakan password baru untuk login ke sistem.
    </p>`;

  return wrapInEmailTemplate(contentHtml);
}
