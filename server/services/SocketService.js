/**
 * Socket.io Server - Real-time Notifications
 */

const { Server } = require("socket.io");

let io = null;
const userSockets = new Map();

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("authenticate", (userId) => {
      if (userId) {
        userSockets.set(userId.toString(), socket.id);
        socket.join(`user:${userId}`);
        console.log(`User ${userId} authenticated on socket ${socket.id}`);
      }
    });

    socket.on("join_room", (room) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on("leave_room", (room) => {
      socket.leave(room);
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

const sendToUser = (userId, event, data) => {
  if (!io) return;

  const socketId = userSockets.get(userId.toString());

  if (socketId) {
    io.to(socketId).emit(event, data);
  }

  io.to(`user:${userId}`).emit(event, data);
};

const sendToRoom = (room, event, data) => {
  if (!io) return;
  io.to(room).emit(event, data);
};

const sendToAll = (event, data) => {
  if (!io) return;
  io.emit(event, data);
};

const emitNewOrder = (order) => {
  if (!io) return;

  for (const vendorId of order.vendorIds) {
    const notification = {
      type: "ORDER_PLACED",
      title: "New Order Received",
      message: `You have a new order #${order.orderNumber} worth $${order.totalPrice.toFixed(2)}`,
      data: { orderId: order._id, orderNumber: order.orderNumber },
      createdAt: new Date(),
    };

    sendToUser(vendorId.toString(), "new_order", notification);
    io.to(`vendor:${vendorId}`).emit("new_order", notification);
  }

  if (order.customer) {
    const customerNotification = {
      type: "ORDER_PLACED",
      title: "Order Confirmed",
      message: `Your order #${order.orderNumber} has been confirmed`,
      data: { orderId: order._id, orderNumber: order.orderNumber },
      createdAt: new Date(),
    };
    sendToUser(
      order.customer.toString(),
      "order_confirmed",
      customerNotification,
    );
  }
};

const emitOrderStatusUpdate = (order, oldStatus, newStatus) => {
  if (!io) return;

  const statusMessages = {
    confirmed: "Your order has been confirmed",
    processing: "Your order is being processed",
    shipped: "Your order has been shipped",
    delivered: "Your order has been delivered",
    cancelled: "Your order has been cancelled",
  };

  const notification = {
    type: `ORDER_${newStatus.toUpperCase()}`,
    title: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
    message:
      statusMessages[newStatus] || `Order status updated to ${newStatus}`,
    data: { orderId: order._id, orderNumber: order.orderNumber },
    createdAt: new Date(),
  };

  if (order.customer) {
    sendToUser(order.customer.toString(), "order_status_update", notification);
  }

  for (const vendorId of order.vendorIds) {
    io.to(`vendor:${vendorId}`).emit("order_status_update", notification);
  }
};

const emitWithdrawalUpdate = (withdrawal) => {
  if (!io) return;

  const statusMessages = {
    processing: "Your withdrawal request is being processed",
    completed: "Your withdrawal has been completed",
    rejected: "Your withdrawal request has been rejected",
  };

  const notification = {
    type: "WITHDRAWAL_PROCESSED",
    title: "Withdrawal Update",
    message:
      statusMessages[withdrawal.status] ||
      `Withdrawal status: ${withdrawal.status}`,
    data: { withdrawalId: withdrawal._id, amount: withdrawal.amount },
    createdAt: new Date(),
  };

  sendToUser(withdrawal.vendorId.toString(), "withdrawal_update", notification);
};

const emitProductApproval = (product, approved) => {
  if (!io) return;

  const notification = {
    type: approved ? "PRODUCT_APPROVED" : "PRODUCT_REJECTED",
    title: approved ? "Product Approved" : "Product Rejected",
    message: approved
      ? `Your product "${product.title}" has been approved`
      : `Your product "${product.title}" has been rejected`,
    data: { productId: product._id },
    createdAt: new Date(),
  };

  sendToUser(product.vendorId.toString(), "product_update", notification);
};

const emitVerificationStatus = (user, verified) => {
  if (!io) return;

  const notification = {
    type: "USER_VERIFIED",
    title: verified ? "Account Verified" : "Verification Required",
    message: verified
      ? "Your account has been verified successfully"
      : "Please complete your verification to access all features",
    data: { userId: user._id },
    createdAt: new Date(),
  };

  sendToUser(user._id.toString(), "verification_update", notification);
};

module.exports = {
  initializeSocket,
  getIO,
  sendToUser,
  sendToRoom,
  sendToAll,
  emitNewOrder,
  emitOrderStatusUpdate,
  emitWithdrawalUpdate,
  emitProductApproval,
  emitVerificationStatus,
};
