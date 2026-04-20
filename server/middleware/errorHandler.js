/**
 * Global Error Handling Middleware
 */

const config = require("../config");

class AppError extends Error {
  constructor(message, statusCode = 500, code = "ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || "error";

  if (config.nodeEnv === "development") {
    return res.status(statusCode).json({
      success: false,
      status,
      code: err.code,
      message: err.message,
      stack: err.stack,
    });
  }

  if (err.isOperational) {
    return res.status(statusCode).json({
      success: false,
      status,
      code: err.code,
      message: err.message,
    });
  }

  console.error("ERROR:", err);
  res.status(500).json({
    success: false,
    status: "error",
    code: "INTERNAL_ERROR",
    message: "Something went wrong",
  });
};

const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route ${req.method} ${req.originalUrl} not found`,
    404,
    "NOT_FOUND",
  );
  next(error);
};

module.exports = { AppError, errorHandler, notFoundHandler };
