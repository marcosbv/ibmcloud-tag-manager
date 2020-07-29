var winston = require('winston');

// define the custom settings for each transport (file, console)
var options = {
  console: {
    level: process.env.LOG_LEVEL || 'info',
    handleExceptions: true,
    json: false,
    colorize: true,
  },
};

// instantiate a new Winston Logger with the settings defined above
var logger = winston.createLogger({
  transports: [
    new winston.transports.Console(options.console)
  ],
  exitOnError: false, // do not exit on handled exceptions
});

module.exports = logger;