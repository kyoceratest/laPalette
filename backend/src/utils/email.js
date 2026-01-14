const nodemailer = require('nodemailer');

// Simple Gmail-based mailer for demo purposes.
// Configure via environment variables in .env:
// GMAIL_USER, GMAIL_PASS (app password), ALERT_SALES_EMAIL
let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (!user || !pass) {
    console.warn('GMAIL_USER / GMAIL_PASS not configured. Email sending is disabled.');
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  return cachedTransporter;
}

async function sendEmail(to, subject, text) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('sendEmail called but transporter is not configured.');
    return;
  }

  const from = process.env.GMAIL_FROM || process.env.GMAIL_USER;

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text
    });
  } catch (err) {
    console.error('Error sending email', err);
  }
}

module.exports = {
  sendEmail
};
