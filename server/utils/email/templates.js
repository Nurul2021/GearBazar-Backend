/**
 * Email Templates - HTML Templates for Notifications
 */

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GearBazar</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); padding: 30px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 28px; font-weight: 600; margin: 0; }
    .content { padding: 30px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    .btn { display: inline-block; padding: 12px 30px; background: #1a73e8; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: 500; margin: 10px 0; }
    .btn:hover { background: #1557b0; }
    .alert { padding: 15px; border-radius: 5px; margin: 15px 0; }
    .alert-success { background: #d4edda; border-left: 4px solid #28a745; color: #155724; }
    .alert-warning { background: #fff3cd; border-left: 4px solid #ffc107; color: #856404; }
    .alert-danger { background: #f8d7da; border-left: 4px solid #dc3545; color: #721c24; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .details-table th, .details-table td { padding: 12px; border: 1px solid #ddd; text-align: left; }
    .details-table th { background: #f8f9fa; font-weight: 600; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-muted { color: #666; }
    .highlight { font-size: 24px; font-weight: bold; color: #1a73e8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GEARBAZAR</h1>
    </div>
    ${content}
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} GearBazar. All rights reserved.</p>
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
`;

const getPasswordResetEmail = (name, resetUrl, expiryMinutes = 30) =>
  baseTemplate(`
  <div class="content">
    <h2 style="margin-bottom: 20px; color: #1a73e8;">Reset Your Password</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>We received a request to reset your GearBazar account password. Click the button below to create a new password:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>
    <div class="alert alert-warning">
      This link will expire in <strong>${expiryMinutes} minutes</strong>. If you didn't request this, please ignore this email.
    </div>
  </div>
`);

const getPasswordResetConfirmationEmail = (name) =>
  baseTemplate(`
  <div class="content">
    <h2 style="margin-bottom: 20px; color: #28a745;">Password Reset Complete</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>Your password has been successfully reset. You can now log in with your new password.</p>
    <div class="alert alert-success">
      If you did not make this change, please contact support immediately.
    </div>
  </div>
`);

const getProductDeletionEmailTemplate = ({
  vendorName,
  productTitle,
  productId,
  reason,
  deletedAt,
}) =>
  baseTemplate(`
  <div class="content">
    <h2 style="margin-bottom: 20px; color: #dc3545;">Product Removed</h2>
    <p>Hello <strong>${vendorName}</strong>,</p>
    <p>Your product has been removed from GearBazar.</p>
    <table class="details-table">
      <tr><th>Product</th><td>${productTitle}</td></tr>
      <tr><th>ID</th><td>${productId}</td></tr>
      <tr><th>Removed</th><td>${new Date(deletedAt).toLocaleDateString()}</td></tr>
    </table>
    <div class="alert alert-danger"><strong>Reason:</strong> ${reason}</div>
    <p>Contact support@gearbazar.com if you have questions.</p>
  </div>
`);

const orderConfirmation = (data) => {
  const {
    orderNumber,
    customerName,
    total,
    items,
    status = "confirmed",
  } = data;
  return baseTemplate(`
    <div class="content">
      <h2 style="margin-bottom: 20px; color: #1a73e8;">Order ${status === "confirmed" ? "Confirmed" : "Placed"}</h2>
      <p>Hello <strong>${customerName || "Customer"}</strong>,</p>
      <p>Your order has been ${status}!</p>
      <div class="alert alert-success"><strong>Order:</strong> ${orderNumber}</div>
      ${
        items
          ? `
      <table class="details-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>${items.map((i) => `<tr><td>${i.title}</td><td>${i.quantity}</td><td>$${i.unitPrice.toFixed(2)}</td><td>$${i.subtotal.toFixed(2)}</td></tr>`).join("")}</tbody>
      </table>`
          : ""
      }
      <p class="text-right"><strong>Total: </strong><span class="highlight">$${(total || 0).toFixed(2)}</span></p>
    </div>
  `);
};

const passwordReset = (data) => {
  const { resetToken, userName, expiryMinutes = 30 } = data;
  return baseTemplate(`
    <div class="content">
      <h2 style="margin-bottom: 20px; color: #1a73e8;">Password Reset</h2>
      <p>Hello <strong>${userName || "User"}</strong>,</p>
      <p>Click below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || "https://gearbazar.com"}/reset-password?token=${resetToken}" class="btn">Reset Password</a>
      </div>
      <div class="alert alert-warning">Expires in ${expiryMinutes} minutes.</div>
    </div>
  `);
};

const emailVerification = (data) => {
  const { verificationToken, userName } = data;
  return baseTemplate(`
    <div class="content">
      <h2 style="margin-bottom: 20px; color: #1a73e8;">Verify Your Email</h2>
      <p>Hello <strong>${userName || "User"}</strong>,</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || "https://gearbazar.com"}/verify-email?token=${verificationToken}" class="btn">Verify Email</a>
      </div>
    </div>
  `);
};

const accountVerified = (data) => {
  const { userName } = data;
  return baseTemplate(`
    <div class="content">
      <h2 style="margin-bottom: 20px; color: #28a745;">Account Verified!</h2>
      <p>Hello <strong>${userName || "User"}</strong>,</p>
      <div class="alert alert-success">Your account has been verified successfully.</div>
    </div>
  `);
};

const withdrawalUpdate = (data) => {
  const { amount, status, userName } = data;
  const statusColors = {
    pending: "#ffc107",
    processing: "#17a2b8",
    completed: "#28a745",
    rejected: "#dc3545",
  };
  return baseTemplate(`
    <div class="content">
      <h2 style="margin-bottom: 20px;">Withdrawal Update</h2>
      <p>Hello <strong>${userName || "User"}</strong>,</p>
      <table class="details-table">
        <tr><th>Amount</th><td class="highlight">$${(amount || 0).toFixed(2)}</td></tr>
        <tr><th>Status</th><td style="color: ${statusColors[status]}; font-weight: bold;">${status?.toUpperCase()}</td></tr>
      </table>
    </div>
  `);
};

const otpVerification = (data) => {
  const { otp, userName } = data;
  return baseTemplate(`
    <div class="content">
      <h2 style="margin-bottom: 20px;">Your OTP Code</h2>
      <p>Hello <strong>${userName || "User"}</strong>,</p>
      <div style="text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a73e8; background: #f8f9fa; padding: 20px; border-radius: 10px;">${otp}</div>
      <div class="alert alert-warning">Expires in 10 minutes.</div>
    </div>
  `);
};

const genericNotification = (data) => {
  const { title, message, actionUrl, actionText } = data;
  return baseTemplate(`
    <div class="content">
      <h2 style="margin-bottom: 20px;">${title || "Notification"}</h2>
      <p>${message || "You have a new notification."}</p>
      ${actionUrl ? `<div style="text-align: center; margin: 30px 0;"><a href="${actionUrl}" class="btn">${actionText || "View"}</a></div>` : ""}
    </div>
  `);
};

module.exports = {
  baseTemplate,
  getPasswordResetEmail,
  getPasswordResetConfirmationEmail,
  getProductDeletionEmailTemplate,
  orderConfirmation,
  passwordReset,
  emailVerification,
  accountVerified,
  withdrawalUpdate,
  otpVerification,
  genericNotification,
};
