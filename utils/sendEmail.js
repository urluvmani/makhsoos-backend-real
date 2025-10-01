// backend/utils/sendEmail.js
import nodemailer from "nodemailer";
import axios from "axios";

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    // don't throw here — we'll let sendEmail decide fallback
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for 587
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // optional timeouts
    socketTimeout: 10_000,
    connectionTimeout: 10_000,
  });

  return transporter;
};

/**
 * Primary: send via SMTP (Brevo relay)
 * Fallback: use Brevo HTTP API if BREVO_API_KEY present
 *
 * params:
 *  - to: string or [{ email, name }]
 *  - subject: string
 *  - html: string (preferred)
 *  - text: string (optional)
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@example.com";

  // Normalize recipients to nodemailer format or API format
  const toForSMTP = Array.isArray(to) ? to : [{ email: to }];
  const toForNodemailer = Array.isArray(to)
    ? to.map((t) => (t.email ? `${t.name ? `${t.name} ` : ""}<${t.email}>` : t))
    : to;

  // Try SMTP first (recommended)
  try {
    const tx = getTransporter();
    if (tx) {
      // verify transporter once (optional)
      try {
        await tx.verify();
      } catch (verifyErr) {
        console.warn("⚠️ SMTP transporter verify failed:", verifyErr.message);
        // proceed to attempt send anyway (nodemailer will error if unusable)
      }

      const info = await tx.sendMail({
        from,
        to: toForNodemailer,
        subject,
        text: text || (html ? html.replace(/<[^>]+>/g, "") : ""),
        html: html || text || "",
      });

      console.log("✅ Email sent via SMTP:", info.messageId);
      return { channel: "smtp", info };
    } else {
      throw new Error("SMTP credentials not configured");
    }
  } catch (smtpErr) {
    console.warn("⚠️ SMTP send failed:", smtpErr.message || smtpErr);

    // Fallback to Brevo HTTP API if API key available
    const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
    if (!BREVO_API_KEY) {
      // No fallback available
      throw new Error(`Email send failed (SMTP) and no BREVO_API_KEY fallback. SMTP error: ${smtpErr.message || smtpErr}`);
    }

    try {
      // Build recipients array
      const recipients = Array.isArray(to)
        ? to.map((t) => ({ email: t.email || t, name: t.name }))
        : [{ email: to }];

      const payload = {
        sender: parseSender(from),
        to: recipients,
        subject,
        htmlContent: html || text || "",
        textContent: text || (html ? html.replace(/<[^>]+>/g, "") : ""),
      };

      const res = await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
        headers: {
          "Content-Type": "application/json",
          "api-key": BREVO_API_KEY,
        },
        timeout: 10000,
      });

      console.log("✅ Email sent via Brevo API:", res.data);
      return { channel: "brevo-api", info: res.data };
    } catch (apiErr) {
      console.error("❌ Brevo API send failed:", apiErr?.response?.data || apiErr.message || apiErr);
      throw new Error(`Both SMTP and Brevo API failed. SMTP error: ${smtpErr.message || smtpErr}; Brevo API error: ${apiErr?.message || apiErr}`);
    }
  }
};

// helper to parse MAIL_FROM string into Brevo API sender object
const parseSender = (from) => {
  // from can be: "Name <email@domain.com>" or "email@domain.com"
  const match = /^(.*)<(.+)>$/.exec(from);
  if (match) {
    const name = match[1].trim();
    const email = match[2].trim();
    return { name, email };
  }
  return { email: from };
};

export default sendEmail;
