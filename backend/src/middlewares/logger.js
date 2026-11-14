/**
 * Request logging middleware
 * Logs all incoming requests with method, path, status, and response time
 */

const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

/**
 * Color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Get color based on HTTP status code
 */
const getStatusColor = (status) => {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  return colors.green;
};

/**
 * Format bytes into human-readable size
 */
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Main request logger middleware
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const { method, originalUrl, ip } = req;

  // Log incoming request
  console.log(
    `${colors.gray}[${new Date().toISOString()}]${colors.reset} ` +
    `${colors.cyan}→ ${method}${colors.reset} ${originalUrl} ` +
    `${colors.gray}(${ip})${colors.reset}`
  );

  // Intercept response to log status after completion
  const originalSend = res.send.bind(res);
  res.send = function (body) {
    const duration = Date.now() - startTime;
    const statusColor = getStatusColor(res.statusCode);
    const size = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body || '', 'utf8');

    console.log(
      `${colors.gray}[${new Date().toISOString()}]${colors.reset} ` +
      `${statusColor}← ${res.statusCode}${colors.reset} ` +
      `${method} ${originalUrl} ` +
      `${colors.gray}${duration}ms ${formatBytes(size)}${colors.reset}`
    );

    // Warn on slow responses
    if (duration > 1000) {
      console.warn(
        `${colors.yellow}[SLOW REQUEST] ${method} ${originalUrl} took ${duration}ms${colors.reset}`
      );
    }

    return originalSend(body);
  };

  next();
};

/**
 * Simple structured logger for services
 */
const logger = {
  info: (message, meta = {}) => {
    console.log(`[${LOG_LEVELS.INFO}] ${new Date().toISOString()} - ${message}`, 
      Object.keys(meta).length ? meta : '');
  },
  warn: (message, meta = {}) => {
    console.warn(`[${LOG_LEVELS.WARN}] ${new Date().toISOString()} - ${message}`, 
      Object.keys(meta).length ? meta : '');
  },
  error: (message, error = null) => {
    console.error(`[${LOG_LEVELS.ERROR}] ${new Date().toISOString()} - ${message}`,
      error ? { message: error.message, stack: error.stack } : '');
  },
};

module.exports = { requestLogger, logger };
