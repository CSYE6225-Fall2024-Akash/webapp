const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        // Only log errors and warnings to console
        new winston.transports.Console({
            level: 'info',
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Log everything to file
        new winston.transports.File({ 
            filename: '/opt/webapp/combined.log'
        })
    ]
});

module.exports = logger;