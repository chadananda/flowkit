/**
 * Logging utilities for the OCR PDF CLI app
 */
import chalk from 'chalk';

/**
 * Log an informational message
 * @param {string} message - The message to log
 */
function logInfo(message) {
  console.log(chalk.blue('[INFO]'), message);
}

/**
 * Log a success message
 * @param {string} message - The message to log
 */
function logSuccess(message) {
  console.log(chalk.green('[DONE]'), message);
}

/**
 * Log an error message
 * @param {string} message - The message to log
 */
function logError(message) {
  console.error(chalk.red('[ERR]'), message);
}

/**
 * Log a warning message
 * @param {string} message - The message to log
 */
function logWarning(message) {
  console.log(chalk.yellow('[WARN]'), message);
}

/**
 * Log a debug message (only when DEBUG env var is set)
 * @param {string} message - The message to log
 */
function logDebug(message) {
  if (process.env.DEBUG) {
    console.log(chalk.gray('[DEBUG]'), message);
  }
}

export {
  logInfo,
  logSuccess,
  logError,
  logWarning,
  logDebug
};
