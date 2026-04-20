/**
 * Payment Service - SSLCommerz Integration
 */

const crypto = require('crypto');
const axios = require('axios');
const paymentConfig = require('../config/paymentConfig');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { AppError } = require('../middleware/errorHandler');

const generateSecureHash = (data) => {
  const signatureData = Object.keys(data)
    .filter(key => data[key] !== undefined && data[key] !== '')
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join('&');

  const hash = crypto
    .createHmac('sha256', paymentConfig.sslCommerz.storePassword)
    .update(signatureData)
    .digest('hex');

  return hash;
};

const verifyWebhookSignature = (postData, expectedSignature) => {
  const calculatedHash = generateSecureHash(postData);
  return crypto.timingSafeEqual(
    Buffer.from(calculatedHash),
    Buffer.from(expectedSignature || '')
  );
};

const initializePayment = async (order, user) => {
  const { sslCommerz } = paymentConfig;

  const transactionId = `GB-${order._id}-${Date.now()}`;
  
  const paymentData = {
    store_id: sslCommerz.storeId,
    store_passwd: sslCommerz.storePassword,
    total_amount: order.totalPrice,
    currency: order.currency || 'USD',
    tran_id: transactionId,
    success_url: `${process.env.FRONTEND_URL}/payment/success?transaction=${transactionId}`,
    fail_url: `${process.env.FRONTEND_URL}/payment/fail?transaction=${transactionId}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?transaction=${transactionId}`,
    ipn_url: `${process.env.API_URL}/api/payments/webhook`,
    product_category: 'Auto Parts',
    product_profile: 'general',
    shipping_method: order.shippingMethod || 'standard',
    product_name: `GearBazar Order #${order.orderNumber}`,
    product_profile: 'general',
    cus_name: order.shippingAddress.fullName,
    cus_email: user.email,
    cus_phone: order.shippingAddress.phone,
    cus_add1: order.shippingAddress.street,
    cus_add2: order.shippingAddress.city,
    cus_city: order.shippingAddress.city,
    cus_state: order.shippingAddress.state,
    cus_postcode: order.shippingAddress.zipCode,
    cus_country: order.shippingAddress.country || 'Bangladesh',
    value_a: order._id.toString(),
    value_b: user._id.toString()
  };

  paymentData.signature_key = generateSecureHash(paymentData);

  const response = await axios.post(
    `${sslCommerz.baseUrl}${sslCommerz.initUrl}`,
    paymentData,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data;
};

const verifyPayment = async (transactionId, amount) => {
  const { sslCommerz } = paymentConfig;

  const verifyData = {
    store_id: sslCommerz.storeId,
    store_passwd: sslCommerz.storePassword,
    tran_id: transactionId,
    val_id: '',
    amount: amount.toString(),
    card_type: '',
    bank_name: '',
    card_no: '',
    currency: '',
    status: ''
  };

  verifyData.signature_key = generateSecureHash(verifyData);

  const response = await axios.post(
    `${sslCommerz.baseUrl}${sslCommerz.validationUrl}`,
    verifyData,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data;
};

const processPaymentSuccess = async (transactionId, paymentData) => {
  const orderId = paymentData.value_a;
  const expectedAmount = parseFloat(paymentData.amount);

  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError('Order not found', 404, 'NOT_FOUND');
  }

  if (Math.abs(order.totalPrice - expectedAmount) > 0.01) {
    throw new AppError('Payment amount mismatch', 400, 'AMOUNT_MISMATCH');
  }

  order.paymentStatus = 'paid';
  order.paymentTransactionId = transactionId;
  order.paidAt = new Date();

  if (order.orderStatus === 'pending') {
    order.orderStatus = 'confirmed';
    order.statusHistory.push({
      status: 'confirmed',
      note: 'Payment successful - Order confirmed',
      timestamp: new Date()
    });
  }

  await order.save();

  return order;
};

const processPaymentFailure = async (transactionId, paymentData) => {
  const orderId = paymentData.value_a;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError('Order not found', 404, 'NOT_FOUND');
  }

  order.paymentStatus = 'failed';
  order.statusHistory.push({
    status: 'payment_failed',
    note: `Payment failed: ${paymentData.fail_reason || 'Unknown'}`,
    timestamp: new Date()
  });

  await order.save();

  return order;
};

const processPaymentCancel = async (transactionId, paymentData) => {
  const orderId = paymentData.value_a;

  const order = await Order.findById(orderId);
  if (!order) {
    return null;
  }

  order.paymentStatus = 'cancelled';
  order.statusHistory.push({
    status: 'payment_cancelled',
    note: 'Payment cancelled by customer',
    timestamp: new Date()
  });

  await order.save();

  return order;
};

module.exports = {
  generateSecureHash,
  verifyWebhookSignature,
  initializePayment,
  verifyPayment,
  processPaymentSuccess,
  processPaymentFailure,
  processPaymentCancel
};