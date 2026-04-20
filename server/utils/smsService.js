/**
 * SMS Service - Multi-channel SMS Notifications
 * Supports BulkSMS BD, Twilio, or other SMS gateways
 */

const axios = require("axios");

const SMS_PROVIDER = process.env.SMS_PROVIDER || "bulksmsbd";

const SMS_PROVIDERS = {
  bulksmsbd: {
    send: async (phone, message) => {
      const apiKey = process.env.BULKSMSBD_API_KEY;
      const senderId = process.env.BULKSMSBD_SENDER_ID;

      if (!apiKey || !senderId) {
        throw new Error("BulkSMS BD not configured");
      }

      const url = "https://bulksmsbd.com/api/smsapi";
      const data = {
        api_key: apiKey,
        senderid: senderId,
        number: phone.replace("+", ""),
        message: message.substring(0, 160),
      };

      const response = await axios.post(url, data, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      return response.data;
    },
  },
  twilio: {
    send: async (phone, message) => {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken) {
        throw new Error("Twilio not configured");
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

      const response = await axios.post(
        url,
        {
          To: phone,
          From: fromNumber,
          Body: message.substring(0, 1600),
        },
        {
          headers: { Authorization: `Basic ${auth}` },
        },
      );

      return response.data;
    },
  },
  mock: {
    send: async (phone, message) => {
      console.log(
        `[MOCK SMS] To: ${phone}, Message: ${message.substring(0, 50)}...`,
      );
      return {
        success: true,
        mock: true,
        phone,
        message: message.substring(0, 160),
      };
    },
  },
};

const sendSMS = async (phone, message) => {
  if (!phone || !message) {
    throw new Error("Phone number and message are required");
  }

  const cleanPhone = phone.replace(/[^0-9+]/g, "");

  if (cleanPhone.length < 10) {
    throw new Error("Invalid phone number");
  }

  const provider = SMS_PROVIDERS[SMS_PROVIDER] || SMS_PROVIDERS.mock;

  try {
    const result = await provider.send(cleanPhone, message);
    return {
      success: true,
      provider: SMS_PROVIDER,
      phone: cleanPhone,
      messageId: result?.id || result?.message_id || Date.now().toString(),
    };
  } catch (error) {
    console.error("SMS send error:", error.message);
    return {
      success: false,
      provider: SMS_PROVIDER,
      error: error.message,
    };
  }
};

const sendOTP = async (phone, otp, purpose = "verification") => {
  const message =
    purpose === "login"
      ? `Your GearBazar login OTP is: ${otp}. Valid for 10 minutes.`
      : `Your GearBazar verification OTP is: ${otp}. Valid for 10 minutes.`;

  return sendSMS(phone, message);
};

const sendOrderAlert = async (phone, orderNumber, status) => {
  const messages = {
    confirmed: `Your GearBazar order ${orderNumber} has been confirmed.`,
    shipped: `Your GearBazar order ${orderNumber} has been shipped!`,
    delivered: `Your GearBazar order ${orderNumber} has been delivered.`,
  };

  const message = messages[status] || `Order ${orderNumber} status: ${status}`;
  return sendSMS(phone, message);
};

const sendWithdrawalAlert = async (phone, amount, status) => {
  const message =
    status === "completed"
      ? `Your withdrawal of $${amount} has been processed successfully.`
      : `Your withdrawal request of $${amount} is ${status}.`;

  return sendSMS(phone, message);
};

const sendBulkSMS = async (recipients, message) => {
  const results = await Promise.all(
    recipients.map((phone) => sendSMS(phone, message)),
  );

  return {
    total: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
};

module.exports = {
  sendSMS,
  sendOTP,
  sendOrderAlert,
  sendWithdrawalAlert,
  sendBulkSMS,
  SMS_PROVIDERS,
};
