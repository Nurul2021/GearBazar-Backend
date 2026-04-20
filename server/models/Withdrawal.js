/**
 * Withdrawal Model - Vendor Withdrawal Requests
 */

const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: [1, 'Withdrawal amount must be at least 1']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'bkash', 'nagad'],
    required: true
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    routingNumber: String,
    accountHolderName: String
  },
  mobileAccount: {
    number: String,
    operator: String
  },
  transactionId: {
    type: String
  },
  processedAt: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  },
  notes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

withdrawalSchema.index({ vendorId: 1, status: 1 });
withdrawalSchema.index({ createdAt: -1 });

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

module.exports = Withdrawal;
