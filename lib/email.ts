import nodemailer from 'nodemailer'

// Gmail SMTP configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  console.log('Email sending is temporarily disabled. Prepare to send password reset email to:', email);
  return { success: true, messageId: 'disabled' };
  /*
  const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`

  const mailOptions = {
    from: 'noreplybmkg@gmail.com',
    to: email,
    subject: 'Reset Password - BMKG Sistem Kalibrasi',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e293b, #1e40af); padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">BMKG - Sistem Kalibrasi</h1>
          <p style="color: #cbd5e1; margin: 10px 0 0 0;">Direktorat Data dan Komputasi</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1e293b; margin-top: 0;">Reset Password</h2>
          <p style="color: #64748b; line-height: 1.6;">
            Anda menerima email ini karena ada permintaan untuk mereset password akun Anda.
          </p>
          <p style="color: #64748b; line-height: 1.6;">
            Klik tombol di bawah ini untuk mengatur ulang password Anda:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
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
            • Link ini berlaku selama 1 jam<br>
            • Jika Anda tidak meminta reset password, abaikan email ini<br>
            • Password Anda tidak akan berubah sampai Anda mengklik link di atas
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <p style="color: #64748b; font-size: 12px;">
            © 2025 BMKG - Direktorat Data dan Komputasi
          </p>
        </div>
      </div>
    `
  }

  try {
    const result = await transporter.sendMail(mailOptions)
    console.log('Password reset email sent:', result.messageId)
    return { success: true, messageId: result.messageId }
  } catch (error) {
    console.error('Error sending password reset email:', error)
    throw new Error('Gagal mengirim email reset password')
  }
*/
}

export async function sendPasswordResetConfirmationEmail(email: string) {
  console.log('Email sending is temporarily disabled. Prepare to send password reset confirmation to:', email);
  return { success: true, messageId: 'disabled' };
  /*
  const mailOptions = {
    from: 'noreplybmkg@gmail.com',
    to: email,
    subject: 'Password Berhasil Diperbarui - BMKG Sistem Kalibrasi',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e293b, #1e40af); padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">BMKG - Sistem Kalibrasi</h1>
          <p style="color: #cbd5e1; margin: 10px 0 0 0;">Direktorat Data dan Komputasi</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1e293b; margin-top: 0;">Password Berhasil Diperbarui</h2>
          <p style="color: #64748b; line-height: 1.6;">
            Password akun Anda telah berhasil diperbarui pada ${new Date().toLocaleString('id-ID')}.
          </p>
          
          <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="color: #0369a1; margin: 0; font-size: 14px;">
              <strong>Keamanan:</strong> Jika Anda tidak melakukan perubahan ini, segera hubungi administrator sistem.
            </p>
          </div>
          
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            Anda sekarang dapat menggunakan password baru untuk login ke sistem.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <p style="color: #64748b; font-size: 12px;">
            © 2025 BMKG - Direktorat Data dan Komputasi
          </p>
        </div>
      </div>
    `
  }
  
  try {
    const result = await transporter.sendMail(mailOptions)
    console.log('Password reset confirmation email sent:', result.messageId)
    return { success: true, messageId: result.messageId }
  } catch (error) {
    console.error('Error sending confirmation email:', error)
    throw new Error('Gagal mengirim email konfirmasi')
  }
  */
}

export async function sendAssignmentNotificationEmail(email: string, role: string, certificateNumber: string, certificateId: number) {
  console.log('Email sending is temporarily disabled. Prepare to send assignment notification to:', email);
  return { success: true, messageId: 'disabled' };
  /*
  const subject = `Anda telah ditugaskan sebagai ${role} untuk Sertifikat ${certificateNumber}`;
  const certificateUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/certificates/${certificateId}/view`;

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e293b, #1e40af); padding: 30px; border-radius: 10px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">BMKG - Sistem Kalibrasi</h1>
      <p style="color: #cbd5e1; margin: 10px 0 0 0;">Direktorat Data dan Komputasi</p>
    </div>
    <div style="background: white; padding: 30px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <h2 style="color: #1e293b; margin-top: 0;">Pemberitahuan Tugas Baru</h2>
      <p style="color: #64748b; line-height: 1.6;">
        Anda telah ditugaskan sebagai ${role} untuk sertifikat dengan nomor:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <p style="background: #f1f5f9; color: #1e293b; padding: 12px 30px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 18px;">
          ${certificateNumber}
        </p>
      </div>
      <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
        Silakan klik tombol di bawah ini untuk melihat detail sertifikat:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${certificateUrl}" 
           style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Lihat Sertifikat
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="color: #64748b; font-size: 12px; line-height: 1.6;">
        <strong>Catatan:</strong><br>
        • Jika Anda merasa ada kesalahan, hubungi administrator sistem.
      </p>
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <p style="color: #64748b; font-size: 12px;">
        © 2025 BMKG - Direktorat Data dan Komputasi
      </p>
    </div>
  </div>
`;

  const mailOptions = {
    from: 'noreplybmkg@gmail.com',
    to: email,
    subject: subject,
    html: html
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`Assignment notification email sent to ${email}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`Error sending assignment notification email to ${email}:`, error);
    throw new Error('Gagal mengirim email notifikasi tugas');
  }
*/
}
