/******************************************************************
 *
 * Module is reponsible logging all operations.
 * @author  Mahendra R
 * @version 1.0
 * @since   2021-02-01
 *
 *******************************************************************/
const winston = require("winston");
const { join } = require("path");
const logger = winston.createLogger({
  level: null,
  transports: [
    new winston.transports.File({
      filename: join(process.env.ROOT_TEMP_DIR, process.env.ERROR_LOG),
      level: "error",
    }),
    new winston.transports.File({
      filename: join(process.env.ROOT_TEMP_DIR, process.env.INFO_LOG),
      level: "info",
    }),
  ],
});

module.exports = { logger };
