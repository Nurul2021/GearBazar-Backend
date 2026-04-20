/**
 * Winston Logger Configuration
 * Handles Error Logs and Access Logs in separate files
 */

const winston = require("winston");
const path = require("path");
const fs = require("fs");

const logDir = path.join(__dirname, "../../logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

winston.addColors(logColors);

const errorFilter = winston.format((info) => {
  return info.level === "error" ? info : false;
});

const accessFilter = winston.format((info) => {
  return info.level === "http" ? info : false;
});

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  }),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.json(),
);

const transports = {
  console: new winston.transports.Console({
    format: consoleFormat,
    level: "debug",
  }),
  errorFile: new winston.transports.File({
    filename: path.join(logDir, "error.log"),
    level: "error",
    format: winston.format.combine(errorFilter(), fileFormat),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 30,
  }),
  accessFile: new winston.transports.File({
    filename: path.join(logDir, "access.log"),
    level: "http",
    format: winston.format.combine(accessFilter(), fileFormat),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 30,
  }),
  combinedFile: new winston.transports.File({
    filename: path.join(logDir, "combined.log"),
    format: fileFormat,
    maxsize: 10 * 1024 * 1024,
    maxFiles: 30,
  }),
};

const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || "info",
  format: fileFormat,
  transports: [
    transports.console,
    transports.errorFile,
    transports.accessFile,
    transports.combinedFile,
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "exceptions.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "rejections.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 30,
    }),
  ],
});

module.exports = logger;
