/**
 * Email Service - Nodemailer Configuration
 */

const nodemailer = require("nodemailer");
const config = require("../../config");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "your-email@gmail.com",
    pass: process.env.SMTP_PASS || "your-app-password",
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === "production",
  },
});

const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    const mailOptions = {
      from: `"GearBazar Team" <${process.env.SMTP_USER || "noreply@gearbazar.com"}>`,
      to,
      subject,
      html,
    };

    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email send error:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { transporter, sendEmail };
