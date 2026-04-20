/**
 * Order Tracking & Invoice Service
 * PDF Generation, Streaming, Email & Cloud Storage
 */

const QRCode = require('qrcode');
const pdf = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Order = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');
const { sendEmail } = require('../utils/email/emailService');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/uploadService');

const generateInvoiceNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${timestamp}-${random}`;
};

const generateQRCode = async (data) => {
  try {
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(data), {
      width: 150,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
    return qrDataUrl;
  } catch (error) {
    console.error('QR Code generation error:', error);
    return null;
  }
};

const generateInvoicePDF = async (order, outputPath) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new pdfkit({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: `Invoice-${order.orderNumber}`,
          Author: 'GearBazar',
          Subject: `Order Invoice ${order.orderNumber}`
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const primaryColor = '#1a73e8';
      const textColor = '#333333';
      const lightGray = '#f5f5f5';

      // Header
      doc.fillColor(primaryColor)
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('GEARBAZAR', 50, 40);

      doc.fillColor(textColor)
        .fontSize(10)
        .font('Helvetica')
        .text('Auto Parts Marketplace', 50, 68);

      doc.fontSize(9)
        .text('support@gearbazar.com | www.gearbazar.com', 50, 82);

      // Invoice Label
      doc.fillColor(primaryColor)
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('INVOICE', 450, 40, { align: 'right' });

      doc.fillColor(textColor)
        .fontSize(10)
        .text(`Invoice #: ${generateInvoiceNumber()}`, 450, 65, { align: 'right' })
        .text(`Order #: ${order.orderNumber}`, 450, 80, { align: 'right' })
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 450, 95, { align: 'right' });

      // Status Badge
      const statusColor = {
        pending: '#ffc107',
        processing: '#17a2b8',
        shipped: '#6610f2',
        delivered: '#28a745',
        cancelled: '#dc3545'
      };

      doc.fillColor(statusColor[order.orderStatus] || '#6c757d')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(order.orderStatus.toUpperCase(), 450, 110, { align: 'right' });

      // Divider
      doc.moveTo(50, 130).lineTo(545, 130).stroke('#e0e0e0');

      // Billing Address
      doc.fillColor(textColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('BILL TO:', 50, 145);

      doc.font('Helvetica')
        .fontSize(10)
        .text(order.shippingAddress.fullName, 50, 160)
        .text(order.shippingAddress.street, 50, 175)
        .text(`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`, 50, 190)
        .text(order.shippingAddress.country || 'Bangladesh', 50, 205);

      // Shipping Address
      doc.font('Helvetica-Bold')
        .text('SHIP TO:', 300, 145);

      doc.font('Helvetica')
        .text(order.shippingAddress.fullName, 300, 160)
        .text(order.shippingAddress.street, 300, 175)
        .text(`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`, 300, 190);

      // Table Header
      const tableTop = 240;
      doc.fillColor(lightGray)
        .rect(50, tableTop, 495, 25)
        .fill();

      doc.fillColor(textColor)
        .fontSize(10)
        .font('Helvetica-Bold');

      doc.text('Item', 55, tableTop + 8);
      doc.text('SKU', 200, tableTop + 8);
      doc.text('Qty', 320, tableTop + 8);
      doc.text('Price', 380, tableTop + 8);
      doc.text('Total', 480, tableTop + 8);

      doc.moveTo(50, tableTop + 25).lineTo(545, tableTop + 25).stroke('#e0e0e0');

      // Items
      let y = tableTop + 35;
      doc.font('Helvetica').fontSize(9);

      for (const item of order.orderItems) {
        const priceType = item.priceType === 'wholesale' ? '(W)' : '(R)';
        
        doc.fillColor(textColor)
          .text(item.title.substring(0, 40), 55, y)
          .text(item.partNumber || '-', 200, y)
          .text(item.quantity.toString(), 320, y)
          .text(`${item.unitPrice.toFixed(2)} ${priceType}`, 380, y)
          .text(`$${item.subtotal.toFixed(2)}`, 480, y);

        y += 20;

        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      }

      // Totals
      const totalsY = y + 20;
      doc.moveTo(350, totalsY).lineTo(545, totalsY).stroke('#e0e0e0');

      doc.font('Helvetica')
        .fontSize(10)
        .text('Subtotal:', 350, totalsY + 10)
        .text(`$${order.subtotal.toFixed(2)}`, 480, totalsY + 10);

      if (order.discountAmount > 0) {
        doc.text('Discount:', 350, totalsY + 28)
          .text(`-$${order.discountAmount.toFixed(2)}`, 480, totalsY + 28);
      }

      doc.text('Shipping:', 350, totalsY + 46)
        .text(`$${order.shippingPrice.toFixed(2)}`, 480, totalsY + 46);

      doc.text('Tax:', 350, totalsY + 64)
        .text(`$${order.taxPrice.toFixed(2)}`, 480, totalsY + 64);

      doc.moveTo(350, totalsY + 75).lineTo(545, totalsY + 75).stroke('#e0e0e0');

      doc.font('Helvetica-Bold')
        .fontSize(12)
        .text('Total:', 350, totalsY + 85)
        .fillColor(primaryColor)
        .text(`$${order.totalPrice.toFixed(2)}`, 480, totalsY + 85);

      // QR Code
      const qrData = {
        orderNumber: order.orderNumber,
        totalPrice: order.totalPrice,
        items: order.orderItems.length,
        status: order.orderStatus
      };

      const qrDataUrl = await generateQRCode(qrData);
      if (qrDataUrl) {
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        const qrBuffer = Buffer.from(base64Data, 'base64');
        doc.image(qrBuffer, 50, totalsY + 100, { width: 80 });
      }

      // Footer
      doc.fillColor(textColor)
        .fontSize(8)
        .text('Thank you for your purchase!', 50, 750, { align: 'center' })
        .text('Terms & Conditions: Returns accepted within 14 days of delivery.', 50, 765, { align: 'center' });

doc.end();

      await new Promise((r) => stream.on('finish', r));
      resolve(outputPath);

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const sendOrderConfirmationEmail = async (order) => {
  try {
    const user = order.customer;
    if (!user) return;

    const itemsList = order.orderItems.map(item => 
      `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.title}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${item.subtotal.toFixed(2)}</td>
      </tr>`
    ).join('');

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background-color: #1a73e8; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .order-details { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .total { font-size: 18px; font-weight: bold; color: #1a73e8; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Confirmed!</h1>
    </div>
    <div class="content">
      <p>Hello <strong>${order.shippingAddress.fullName}</strong>,</p>
      <p>Thank you for your order! Here are your order details:</p>
      
      <div class="order-details">
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${order.orderStatus.toUpperCase()}</p>
      </div>

      <h3>Order Items</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f2f2f2;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Item</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Qty</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Price</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsList}
        </tbody>
      </table>

      <div class="order-details">
        <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
        <p>Shipping: $${order.shippingPrice.toFixed(2)}</p>
        <p>Tax: $${order.taxPrice.toFixed(2)}</p>
        <p class="total">Total: $${order.totalPrice.toFixed(2)}</p>
      </div>

      <p>We'll notify you when your order is shipped. You can track your order using the order number.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} GearBazar. All rights reserved.</p>
      <p>This is an automated email - please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmail(
      user.email,
      `Order Confirmed - ${order.orderNumber}`,
      emailHtml
    );

    return true;
  } catch (error) {
    console.error('Order confirmation email error:', error);
    return false;
  }
};

const getOrderTrackingInfo = async (orderId, userId, userRole) => {
  const query = { _id: orderId };
  if (userRole === 'customer') {
    query.customer = userId;
  }

  const order = await Order.findOne(query)
    .populate('customer', 'name email')
    .populate('orderItems.vendorId', 'name shopName')
    .lean();

  if (!order) {
    throw new AppError('Order not found', 404, 'NOT_FOUND');
  }

  const trackingSteps = [
    { status: 'pending', label: 'Order Placed', description: 'Your order has been received', completed: true },
    { status: 'confirmed', label: 'Confirmed', description: 'Order confirmed and processing', completed: ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.orderStatus) },
    { status: 'processing', label: 'Processing', description: 'Your items are being prepared', completed: ['processing', 'shipped', 'delivered'].includes(order.orderStatus) },
    { status: 'shipped', label: 'Shipped', description: 'Order has been shipped', completed: ['shipped', 'delivered'].includes(order.orderStatus) },
    { status: 'delivered', label: 'Delivered', description: 'Order delivered successfully', completed: order.orderStatus === 'delivered' }
  ];

  const currentStepIndex = trackingSteps.findIndex(step => step.status === order.orderStatus);

  return {
    order,
    tracking: {
      currentStep: currentStepIndex >= 0 ? currentStepIndex + 1 : 0,
      totalSteps: trackingSteps.length,
      steps: trackingSteps,
      lastUpdated: order.updatedAt
    }
  };
};

const generateInvoicePDFBuffer = async (order) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new pdfkit({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: `Invoice-${order.orderNumber}`,
          Author: 'GearBazar',
          Subject: `Order Invoice ${order.orderNumber}`
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const invoiceNumber = generateInvoiceNumber();
      const primaryColor = '#1a73e8';
      const textColor = '#333333';
      const lightGray = '#f5f5f5';

      doc.fillColor(primaryColor)
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('GEARBAZAR', 50, 40);

      doc.fillColor(textColor)
        .fontSize(10)
        .font('Helvetica')
        .text('Auto Parts Marketplace', 50, 68)
        .text('support@gearbazar.com | www.gearbazar.com', 50, 82);

      doc.fillColor(primaryColor)
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('INVOICE', 450, 40, { align: 'right' });

      doc.fillColor(textColor)
        .fontSize(10)
        .text(`Invoice #: ${invoiceNumber}`, 450, 65, { align: 'right' })
        .text(`Order #: ${order.orderNumber}`, 450, 80, { align: 'right' })
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 450, 95, { align: 'right' });

      const statusColor = {
        pending: '#ffc107', processing: '#17a2b8', shipped: '#6610f2',
        delivered: '#28a745', cancelled: '#dc3545'
      };

      doc.fillColor(statusColor[order.orderStatus] || '#6c757d')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(order.orderStatus.toUpperCase(), 450, 110, { align: 'right' });

      doc.moveTo(50, 130).lineTo(545, 130).stroke('#e0e0e0');

      doc.fillColor(textColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('BILL TO:', 50, 145);

      doc.font('Helvetica').fontSize(10)
        .text(order.shippingAddress.fullName, 50, 160)
        .text(order.shippingAddress.street, 50, 175)
        .text(`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`, 50, 190)
        .text(order.shippingAddress.country || 'USA', 50, 205);

      doc.font('Helvetica-Bold').text('SHIP TO:', 300, 145);
      doc.font('Helvetica').text(order.shippingAddress.fullName, 300, 160)
        .text(order.shippingAddress.street, 300, 175)
        .text(`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`, 300, 190);

      if (order.vendorIds && order.vendorIds.length > 0) {
        doc.font('Helvetica-Bold').text('SELLERS:', 50, 225);
        doc.font('Helvetica').fontSize(9);
        const vendorNames = order.vendorIds.map(v => v.name || v.shopName || 'Unknown').join(', ');
        doc.text(vendorNames.substring(0, 80), 50, 240);
      }

      const tableTop = order.vendorIds?.length ? 270 : 250;
      doc.fillColor(lightGray).rect(50, tableTop, 495, 25).fill();
      doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold');
      doc.text('Item', 55, tableTop + 8);
      doc.text('SKU', 180, tableTop + 8);
      doc.text('Type', 280, tableTop + 8);
      doc.text('Qty', 340, tableTop + 8);
      doc.text('Price', 400, tableTop + 8);
      doc.text('Total', 490, tableTop + 8);

      doc.moveTo(50, tableTop + 25).lineTo(545, tableTop + 25).stroke('#e0e0e0');

      let y = tableTop + 35;
      doc.font('Helvetica').fontSize(9);

      for (const item of order.orderItems) {
        const priceType = item.priceType === 'wholesale' ? 'Wholesale' : 'Retail';
        doc.fillColor(textColor)
          .text(item.title?.substring(0, 35) || '-', 55, y)
          .text(item.partNumber || '-', 180, y)
          .text(priceType, 280, y)
          .text(item.quantity.toString(), 340, y)
          .text(`$${item.unitPrice.toFixed(2)}`, 400, y)
          .text(`$${item.subtotal.toFixed(2)}`, 490, y);
        y += 18;
        if (y > 700) { doc.addPage(); y = 50; }
      }

      const totalsY = y + 20;
      doc.moveTo(350, totalsY).lineTo(545, totalsY).stroke('#e0e0e0');
      doc.font('Helvetica').fontSize(10);
      doc.text('Subtotal:', 350, totalsY + 10).text(`$${order.subtotal.toFixed(2)}`, 480, totalsY + 10);

      if (order.discountAmount > 0) {
        doc.text('Discount:', 350, totalsY + 28).text(`-$${order.discountAmount.toFixed(2)}`, 480, totalsY + 28);
      }

      doc.text('Shipping:', 350, totalsY + 46).text(`$${order.shippingPrice.toFixed(2)}`, 480, totalsY + 46);
      doc.text('Tax:', 350, totalsY + 64).text(`$${order.taxPrice.toFixed(2)}`, 480, totalsY + 64);

      if (order.commissionAmount > 0) {
        doc.text('Platform Fee:', 350, totalsY + 82).text(`$${order.commissionAmount.toFixed(2)}`, 480, totalsY + 82);
      }

      doc.moveTo(350, totalsY + 95).lineTo(545, totalsY + 95).stroke('#e0e0e0');
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Total:', 350, totalsY + 105).fillColor(primaryColor).text(`$${order.totalPrice.toFixed(2)}`, 480, totalsY + 105);

      const qrData = { orderNumber: order.orderNumber, totalPrice: order.totalPrice, items: order.orderItems.length, status: order.orderStatus };
      const qrDataUrl = await generateQRCode(qrData);
      if (qrDataUrl) {
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        const qrBuffer = Buffer.from(base64Data, 'base64');
        doc.image(qrBuffer, 50, totalsY + 120, { width: 70 });
      }

      doc.fillColor(textColor).fontSize(8)
        .text('Thank you for your purchase!', 50, 750, { align: 'center' })
        .text('Terms: Returns accepted within 14 days of delivery.', 50, 765, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const streamInvoiceToResponse = async (order, res) => {
  const pdfBuffer = await generateInvoicePDFBuffer(order);
  
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Invoice-${order.orderNumber}.pdf"`,
    'Content-Length': pdfBuffer.length
  });
  
  res.send(pdfBuffer);
};

const uploadInvoiceToCloud = async (order) => {
  try {
    const pdfBuffer = await generateInvoicePDFBuffer(order);
    const invoiceNumber = generateInvoiceNumber();
    const folder = 'gearbazar/invoices';
    
    const result = await uploadToCloudinary(pdfBuffer, {
      folder,
      preset: 'original',
      publicId: `${folder}/${order.orderNumber}-${invoiceNumber}`,
      resource_type: 'raw'
    });

    return {
      success: true,
      publicId: result.publicId,
      secureUrl: result.secureUrl
    };
  } catch (error) {
    console.error('Cloud upload error:', error);
    return { success: false, error: error.message };
  }
};

const sendInvoiceEmail = async (order, recipientEmail, recipientName) => {
  try {
    const pdfBuffer = await generateInvoicePDFBuffer(order);
    const invoiceNumber = generateInvoiceNumber();
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background-color: #1a73e8; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .invoice-box { background: white; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
          .total { font-size: 18px; font-weight: bold; color: #1a73e8; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice - ${order.orderNumber}</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${recipientName}</strong>,</p>
            <p>Please find attached your invoice for order <strong>${order.orderNumber}</strong>.</p>
            <div class="invoice-box">
              <p><strong>Order Number:</strong> ${order.orderNumber}</p>
              <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
              <p><strong>Items:</strong> ${order.orderItems.length}</p>
              <p><strong>Total:</strong> <span class="total">$${order.totalPrice.toFixed(2)}</span></p>
            </div>
            <p>You can also download this invoice from your account.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} GearBazar. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>`;

    const attachments = [{
      filename: `Invoice-${order.orderNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }];

    await sendEmail(recipientEmail, `Invoice for Order ${order.orderNumber}`, emailHtml, attachments);

    return { success: true };
  } catch (error) {
    console.error('Invoice email error:', error);
    return { success: false, error: error.message };
  }
};

const generateAndSaveInvoice = async (order) => {
  const uploadResult = await uploadInvoiceToCloud(order);
  
  if (uploadResult.success) {
    order.invoiceUrl = uploadResult.secureUrl;
    order.invoicePublicId = uploadResult.publicId;
    order.invoiceGeneratedAt = new Date();
    await order.save();
  }
  
  return uploadResult;
};

module.exports = {
  generateInvoicePDF,
  generateInvoicePDFBuffer,
  streamInvoiceToResponse,
  uploadInvoiceToCloud,
  sendInvoiceEmail,
  generateAndSaveInvoice,
  sendOrderConfirmationEmail,
  getOrderTrackingInfo,
  generateQRCode
};