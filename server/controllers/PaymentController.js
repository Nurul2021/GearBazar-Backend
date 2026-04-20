/**
 * Payment Controller - Checkout and Webhook Handling
 */

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const PaymentService = require('../services/PaymentService');
const { AppError } = require('../middleware/errorHandler');

const checkout = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { orderId } = req.body;

    const order = await Order.findOne({ _id: orderId, customer: userId });
    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    if (order.paymentStatus === 'paid') {
      throw new AppError('Order is already paid', 400, 'ALREADY_PAID');
    }

    if (order.paymentStatus === 'failed') {
      throw new AppError('Previous payment attempt failed', 400, 'PAYMENT_FAILED');
    }

    const user = await User.findById(userId);

    const paymentResponse = await PaymentService.initializePayment(order, user);

    if (paymentResponse.status === 'SUCCESS' || paymentResponse.status === 'MERCHANT_VALIDATION_SUCCESS') {
      await Order.findByIdAndUpdate(orderId, {
        $set: {
          'payment.transactionId': paymentResponse.tran_id,
          'payment.gatewayResponse': paymentResponse
        }
      });

      res.status(200).json({
        success: true,
        message: 'Payment session initialized',
        data: {
          paymentUrl: paymentResponse.redirectGatewayURL,
          transactionId: paymentResponse.tran_id,
          gatewayPage: paymentResponse.redirectGatewayURL
        }
      });
    } else {
      throw new AppError(
        `Payment initialization failed: ${paymentResponse.failedreason || 'Unknown error'}`,
        400,
        'PAYMENT_INIT_FAILED'
      );
    }
  } catch (error) {
    next(error);
  }
};

const webhookHandler = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const postData = req.body;

    console.log('Payment Webhook Received:', postData);

    const requiredFields = ['status', 'tran_id', 'amount', 'store_id', 'signature'];
    for (const field of requiredFields) {
      if (!postData[field]) {
        console.error(`Missing required field: ${field}`);
        return res.status(400).send('Missing required fields');
      }
    }

    if (postData.store_id !== process.env.SSL_STORE_ID) {
      console.error('Invalid store ID in webhook');
      return res.status(400).send('Invalid store');
    }

    const transactionId = postData.tran_id;
    const status = postData.status.toLowerCase();

    let order;
    
    try {
      switch (status) {
        case 'valid':
        case 'success':
          order = await PaymentService.processPaymentSuccess(transactionId, postData);
          console.log(`Payment SUCCESS for transaction: ${transactionId}, Order: ${order._id}`);
          break;

        case 'failed':
          order = await PaymentService.processPaymentFailure(transactionId, postData);
          console.log(`Payment FAILED for transaction: ${transactionId}`);
          break;

        case 'cancel':
          order = await PaymentService.processPaymentCancel(transactionId, postData);
          console.log(`Payment CANCELLED for transaction: ${transactionId}`);
          break;

        case 'pending':
          console.log(`Payment PENDING for transaction: ${transactionId}`);
          break;

        case 'invalid':
          console.error(`Invalid payment for transaction: ${transactionId}`);
          break;

        default:
          console.warn(`Unknown payment status: ${status}`);
      }
    } catch (dbError) {
      console.error('Error processing payment webhook:', dbError);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).send('Error processing payment');
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).send('SUCCESS');
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Webhook error:', error);
    res.status(500).send('ERROR');
  }
};

const paymentSuccessRedirect = async (req, res, next) => {
  try {
    const { transaction } = req.query;

    const order = await Order.findOne({ 'payment.transactionId': transaction })
      .populate('customer', 'name email');

    if (!order) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment/fail?error=order_not_found`);
    }

    if (order.paymentStatus === 'paid') {
      await Cart.findOneAndUpdate(
        { user: order.customer._id },
        { items: [], totalItems: 0, subtotal: 0 }
      );

      return res.redirect(`${process.env.FRONTEND_URL}/payment/success?order=${order.orderNumber}`);
    }

    res.redirect(`${process.env.FRONTEND_URL}/payment/pending?transaction=${transaction}`);
  } catch (error) {
    next(error);
  }
};

const paymentFailureRedirect = async (req, res, next) => {
  try {
    const { transaction, error } = req.query;

    res.redirect(`${process.env.FRONTEND_URL}/payment/fail?transaction=${transaction || ''}&error=${error || ''}`);
  } catch (error) {
    next(error);
  }
};

const paymentCancelRedirect = async (req, res, next) => {
  try {
    const { transaction } = req.query;

    res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?transaction=${transaction || ''}`);
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { transactionId, orderId } = req.body;

    if (!transactionId || !orderId) {
      throw new AppError('Transaction ID and Order ID are required', 400, 'VALIDATION_ERROR');
    }

    const order = await Order.findOne({ _id: orderId, customer: req.userId });
    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    const paymentData = await PaymentService.verifyPayment(
      transactionId,
      order.totalPrice
    );

    res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        paymentStatusDetail: paymentData.status,
        transactionId: transactionId
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkout,
  webhookHandler,
  paymentSuccessRedirect,
  paymentFailureRedirect,
  paymentCancelRedirect,
  verifyPayment
};