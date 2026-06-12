import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const createTransporter = () => {
  if (process.env.EMAIL_PROVIDER === 'sendgrid') {
    // SendGrid via nodemailer (SMTP)
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY },
    });
  }

  // Default: SMTP (Gmail)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: !!(process.env.SMTP_PORT && Number(process.env.SMTP_PORT) === 465),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const transporter = createTransporter();

export async function sendVerificationEmail(to, token, fullName) {
  try {
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const link = `${appUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || `no-reply@${process.env.SMTP_USER?.split('@')?.[1] || 'example.com'}`,
      to,
      subject: 'Please verify your email',
      html: `
        <p>Hi ${fullName || ''},</p>
        <p>Thanks for registering. Please verify your email by clicking the link below:</p>
        <p><a href="${link}">Verify my email</a></p>
        <p>If the link doesn't work, copy and paste this URL into your browser:</p>
        <p>${link}</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info({ to, link, messageId: info.messageId }, 'Verification email sent');
    return info;
  } catch (error) {
    logger.error('Failed to send verification email', error);
    throw error;
  }
}

export async function sendResetPasswordEmail(to, token, fullName) {
  try {
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const link = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || `no-reply@${process.env.SMTP_USER?.split('@')?.[1] || 'example.com'}`,
      to,
      subject: 'Reset your password',
      html: `
        <p>Hi ${fullName || ''},</p>
        <p>You requested a password reset. Please reset your password by clicking the link below:</p>
        <p><a href="${link}">Reset my password</a></p>
        <p>If the link doesn't work, copy and paste this URL into your browser:</p>
        <p>${link}</p>
        <p>This link will expire in 1 hour.</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info({ to, link, messageId: info.messageId }, 'Reset password email sent');
    return info;
  } catch (error) {
    logger.error('Failed to send reset password email', error);
    throw error;
  }
}

export default { sendVerificationEmail, sendResetPasswordEmail };
