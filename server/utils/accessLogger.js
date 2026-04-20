/**
 * HTTP Access Logger Middleware
 * Uses Morgan + Winston for access logging
 */

const morgan = require("morgan");
const logger = require("./logger");

const accessLogStream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

const morganFormat =
  ":remote-addr - :method :url :status :res[content-length] - :response-time ms";

const accessLogger = morgan(morganFormat, {
  stream: accessLogStream,
  skip: (req) => {
    return req.originalUrl === "/api/health";
  },
});

const errorLogger = {
  log: (err, req, res, next) => {
    const errorLog = {
      message: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    };
    logger.error(JSON.stringify(errorLog));
    next(err);
  },
};

module.exports = { accessLogger, errorLogger };
