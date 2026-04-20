/**
 * Notification Service - Multi-channel Notification Manager
 */

const Notification = require("../models/Notification");
const {
  sendToUser,
  emitNewOrder,
  emitOrderStatusUpdate,
  emitWithdrawalUpdate,
  emitProductApproval,
  emitVerificationStatus,
} = require("../services/SocketService");
const { sendEmail } = require("../utils/email/emailService");
const { sendSMS } = require("../utils/smsService");
const emailTemplates = require("../utils/email/templates");

class NotificationService {
  async send(userId, options) {
    const {
      type,
      title,
      message,
      data,
      channels = ["in_app"],
      referenceId,
      referenceModel,
      email,
      phone,
    } = options;

    const results = { in_app: null, email: null, sms: null };

    if (channels.includes("in_app")) {
      results.in_app = await this.sendInApp(userId, {
        type,
        title,
        message,
        data,
        referenceId,
        referenceModel,
      });
    }

    if (channels.includes("email") && email) {
      results.email = await this.sendEmailNotification(email, type, {
        title,
        message,
        ...data,
      });
    }

    if (channels.includes("sms") && phone) {
      results.sms = await this.sendSMSNotification(phone, message);
    }

    return results;
  }

  async sendInApp(userId, options) {
    const { type, title, message, data, referenceId, referenceModel } = options;

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data,
      channel: "in_app",
      referenceId,
      referenceModel,
      status: "unread",
    });

    sendToUser(userId, "notification", {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      createdAt: notification.createdAt,
    });

    return notification;
  }

  async sendEmailNotification(email, type, data) {
    try {
      let template;
      let subject;

      switch (type) {
        case "ORDER_PLACED":
        case "ORDER_CONFIRMED":
          subject = `Order Confirmation - ${data.orderNumber || ""}`;
          template = emailTemplates.orderConfirmation(data);
          break;
        case "PASSWORD_RESET":
          subject = "Password Reset Request";
          template = emailTemplates.passwordReset(data);
          break;
        case "EMAIL_VERIFICATION":
          subject = "Verify Your Email";
          template = emailTemplates.emailVerification(data);
          break;
        case "USER_VERIFIED":
          subject = "Account Verified";
          template = emailTemplates.accountVerified(data);
          break;
        case "WITHDRAWAL_PROCESSED":
          subject = "Withdrawal Update";
          template = emailTemplates.withdrawalUpdate(data);
          break;
        default:
          subject = data.title || "GearBazar Notification";
          template = emailTemplates.genericNotification(data);
      }

      const result = await sendEmail(email, subject, template);

      return { success: result.success, error: result.error };
    } catch (error) {
      console.error("Email notification error:", error);
      return { success: false, error: error.message };
    }
  }

  async sendSMSNotification(phone, message) {
    try {
      const result = await sendSMS(phone, message);
      return result;
    } catch (error) {
      console.error("SMS notification error:", error);
      return { success: false, error: error.message };
    }
  }

  async sendBulk(userIds, options) {
    const results = await Promise.all(
      userIds.map((userId) => this.send(userId, options)),
    );
    return results;
  }

  async notifyNewOrder(order) {
    emitNewOrder(order);

    for (const vendorId of order.vendorIds) {
      await this.sendInApp(vendorId.toString(), {
        type: "ORDER_PLACED",
        title: "New Order Received",
        message: `New order #${order.orderNumber} - $${order.totalPrice.toFixed(2)}`,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          total: order.totalPrice,
        },
        referenceId: order._id,
        referenceModel: "Order",
      });
    }
  }

  async notifyOrderStatus(order, oldStatus, newStatus) {
    emitOrderStatusUpdate(order, oldStatus, newStatus);

    if (order.customer) {
      await this.sendInApp(order.customer.toString(), {
        type: `ORDER_${newStatus.toUpperCase()}`,
        title: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        message: `Your order #${order.orderNumber} is now ${newStatus}`,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: newStatus,
        },
        referenceId: order._id,
        referenceModel: "Order",
      });
    }
  }

  async notifyWithdrawal(withdrawal) {
    emitWithdrawalUpdate(withdrawal);

    await this.sendInApp(withdrawal.vendorId.toString(), {
      type: "WITHDRAWAL_PROCESSED",
      title: "Withdrawal Update",
      message: `Your withdrawal request for $${withdrawal.amount} is ${withdrawal.status}`,
      data: {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
      },
      referenceId: withdrawal._id,
      referenceModel: "Withdrawal",
    });
  }

  async notifyProductStatus(product, approved) {
    emitProductApproval(product, approved);

    await this.sendInApp(product.vendorId.toString(), {
      type: approved ? "PRODUCT_APPROVED" : "PRODUCT_REJECTED",
      title: approved ? "Product Approved" : "Product Rejected",
      message: approved
        ? `Your product "${product.title}" has been approved`
        : `Your product "${product.title}" has been rejected`,
      data: { productId: product._id, title: product.title },
      referenceId: product._id,
      referenceModel: "Product",
    });
  }

  async notifyVerification(user, verified) {
    emitVerificationStatus(user, verified);

    await this.sendInApp(user._id.toString(), {
      type: "USER_VERIFIED",
      title: verified ? "Account Verified" : "Verification Required",
      message: verified
        ? "Your account has been verified successfully"
        : "Please complete your verification",
      data: { userId: user._id },
      referenceId: user._id,
      referenceModel: "User",
    });
  }

  async getUserNotifications(userId, options = {}) {
    const { page = 1, limit = 20, status, type } = options;

    const query = { userId };
    if (status) query.status = status;
    if (type) query.type = type;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      userId,
      status: "unread",
    });

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });
    if (!notification) {
      throw new Error("Notification not found");
    }
    return notification.markAsRead();
  }

  async markAllAsRead(userId) {
    return Notification.updateMany(
      { userId, status: "unread" },
      { status: "read", readAt: new Date() },
    );
  }

  async deleteNotification(notificationId, userId) {
    return Notification.findOneAndDelete({ _id: notificationId, userId });
  }

  async getUnreadCount(userId) {
    return Notification.getUnreadCount(userId);
  }
}

module.exports = new NotificationService();
