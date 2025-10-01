import nodemailer from "nodemailer";

let transporter;
export const getTransporter = () => {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP credentials missing in env");
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for 587/25
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
};

export const sendEmail = async ({ to, subject, html }) => {
  const from = process.env.MAIL_FROM || "no-reply@example.com";
  const tx = getTransporter();
  const info = await tx.sendMail({ from, to, subject, html });
  return info;
};
