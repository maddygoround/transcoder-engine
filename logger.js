/******************************************************************
 *
 * Module is reponsible logging all operations.
 * @author  Mahendra R
 * @version 1.0
 * @since   2021-02-01
 *
 *******************************************************************/
const winston = require("winston");
const logger = winston.createLogger({
  level: null,
  transports: [new winston.transports.Console()],
});

module.exports = { logger };
