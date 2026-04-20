/**
 * Payment Configuration
 */

module.exports = {
  sslCommerz: {
    storeId: process.env.SSL_STORE_ID || 'your_store_id',
    storePassword: process.env.SSL_STORE_PASSWORD || 'your_store_password',
    isLive: process.env.NODE_ENV === 'production',
    baseUrl: process.env.NODE_ENV === 'production' 
      ? 'https://securepay.sslcommerz.com' 
      : 'https://sandbox.sslcommerz.com',
    initUrl: '/gw/process/v4/',
    validationUrl: '/gw/validate/v3/',
    refundUrl: '/gw/refund/v3/'
  },
  bkash: {
    appKey: process.env.BKASH_APP_KEY || 'your_app_key',
    appSecret: process.env.BKASH_APP_SECRET || 'your_app_secret',
    username: process.env.BKASH_USERNAME || 'your_username',
    password: process.env.BKASH_PASSWORD || 'your_password',
    baseUrl: process.env.NODE_ENV === 'production'
      ? 'https://checkoutpay.bkash.com'
      : 'https://checkout.sandbox.bkash.com'
  },
  hashAlgorithm: 'SHA256',
  webhookRetry: 3
};