import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

// ─── Create SMTP transporter with timeouts and pooling ─────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = port === 465; // true for 465 (SSL), false for 587 (STARTTLS)

  const config = {
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Connection timeouts to prevent hanging on Render/cloud
    connectionTimeout: 10000, // 10s to establish connection
    greetingTimeout: 10000,   // 10s for SMTP greeting
    socketTimeout: 15000,     // 15s for socket inactivity
    // Connection pooling for better performance
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    // TLS options for cloud environments
    tls: {
      rejectUnauthorized: false, // accept self-signed certs (some cloud SMTP relays)
    },
  };

  logger.info({ host, port, secure, user: process.env.SMTP_USER }, 'Creating SMTP transporter');
  _transporter = nodemailer.createTransport(config);

  // Verify SMTP connection on startup (non-blocking)
  _transporter.verify()
    .then(() => logger.info('✅ SMTP connection verified successfully'))
    .catch((err) => logger.error({ err: err.message, code: err.code }, '❌ SMTP connection verification failed'));

  return _transporter;
}

// ─── Helper: get "from" address ────────────────────────────────────────────
function getFromAddress() {
  return process.env.EMAIL_FROM
    || process.env.SMTP_USER
    || `no-reply@example.com`;
}

// ─── Send Verification Email ───────────────────────────────────────────────
export async function sendVerificationEmail(to, token, fullName) {
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const link = `${appUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

  const mailOptions = {
    from: `"WebCall" <${getFromAddress()}>`,
    to,
    subject: '🔐 Xác thực email của bạn - WebCall',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #fff8f3; border-radius: 16px;">
        <h2 style="color: #a4370f; margin-bottom: 16px;">Xin chào ${fullName || ''},</h2>
        <p style="color: #1d1b18; font-size: 15px; line-height: 1.6;">
          Cảm ơn bạn đã đăng ký tài khoản trên <strong>WebCall</strong>. 
          Vui lòng bấm nút bên dưới để xác thực địa chỉ email:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${link}" 
             style="display: inline-block; background: #a4370f; color: #fff; padding: 14px 32px; 
                    border-radius: 999px; text-decoration: none; font-weight: bold; font-size: 15px;">
            ✉️ Xác thực Email
          </a>
        </div>
        <p style="color: #58423b; font-size: 13px;">
          Nếu nút không hoạt động, hãy sao chép và dán link sau vào trình duyệt:<br/>
          <a href="${link}" style="color: #a4370f; word-break: break-all;">${link}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #dfc0b7; margin: 24px 0;" />
        <p style="color: #8c7169; font-size: 12px;">
          Link này có hiệu lực trong 24 giờ. Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email.
        </p>
      </div>
    `,
  };

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    logger.info({ to, messageId: info.messageId, response: info.response }, 'Verification email sent');
    return info;
  } catch (error) {
    logger.error({
      err: error.message,
      code: error.code,
      command: error.command,
      to,
    }, 'Failed to send verification email');
    throw error;
  }
}

// ─── Send Reset Password Email ─────────────────────────────────────────────
export async function sendResetPasswordEmail(to, token, fullName) {
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const link = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

  const mailOptions = {
    from: `"WebCall" <${getFromAddress()}>`,
    to,
    subject: '🔑 Đặt lại mật khẩu - WebCall',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #fff8f3; border-radius: 16px;">
        <h2 style="color: #a4370f; margin-bottom: 16px;">Xin chào ${fullName || ''},</h2>
        <p style="color: #1d1b18; font-size: 15px; line-height: 1.6;">
          Bạn đã yêu cầu đặt lại mật khẩu. Bấm nút bên dưới để tiếp tục:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${link}" 
             style="display: inline-block; background: #a4370f; color: #fff; padding: 14px 32px; 
                    border-radius: 999px; text-decoration: none; font-weight: bold; font-size: 15px;">
            🔑 Đặt lại mật khẩu
          </a>
        </div>
        <p style="color: #58423b; font-size: 13px;">
          Nếu nút không hoạt động:<br/>
          <a href="${link}" style="color: #a4370f; word-break: break-all;">${link}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #dfc0b7; margin: 24px 0;" />
        <p style="color: #8c7169; font-size: 12px;">
          Link có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, vui lòng bỏ qua.
        </p>
      </div>
    `,
  };

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    logger.info({ to, messageId: info.messageId, response: info.response }, 'Reset password email sent');
    return info;
  } catch (error) {
    logger.error({
      err: error.message,
      code: error.code,
      command: error.command,
      to,
    }, 'Failed to send reset password email');
    throw error;
  }
}

// ─── Send Meeting Invite Email ─────────────────────────────────────────────
export async function sendMeetingInviteEmail(to, roomCode, hostName, fullName) {
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const link = `${appUrl}/lobby?code=${roomCode}`;

  const mailOptions = {
    from: `"WebCall" <${getFromAddress()}>`,
    to,
    subject: `📹 ${hostName} mời bạn tham gia cuộc họp - WebCall`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #fff8f3; border-radius: 16px;">
        <h2 style="color: #a4370f; margin-bottom: 16px;">Xin chào ${fullName || ''},</h2>
        <p style="color: #1d1b18; font-size: 15px; line-height: 1.6;">
          <strong>${hostName}</strong> đã mời bạn tham gia một phòng họp trên <strong>WebCall</strong>.
        </p>
        <p style="color: #1d1b18; font-size: 15px;">
          <strong>Mã phòng:</strong> <code style="background: #f3ede8; padding: 4px 8px; border-radius: 6px;">${roomCode}</code>
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${link}" 
             style="display: inline-block; background: #a4370f; color: #fff; padding: 14px 32px; 
                    border-radius: 999px; text-decoration: none; font-weight: bold; font-size: 15px;">
            📹 Tham gia phòng họp
          </a>
        </div>
        <p style="color: #58423b; font-size: 13px;">
          Hoặc truy cập:<br/>
          <a href="${link}" style="color: #a4370f; word-break: break-all;">${link}</a>
        </p>
      </div>
    `,
  };

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    logger.info({ to, roomCode, messageId: info.messageId }, 'Meeting invitation email sent');
    return info;
  } catch (error) {
    logger.error({
      err: error.message,
      code: error.code,
      to,
      roomCode,
    }, 'Failed to send meeting invitation email');
    throw error;
  }
}

export default { sendVerificationEmail, sendResetPasswordEmail, sendMeetingInviteEmail };
