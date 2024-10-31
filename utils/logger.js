const winston = require('winston');
const CloudWatchTransport = require('winston-cloudwatch');


var options = {
    file: {
      level: 'info',
      filename: `/opt/webapp/combined.log`,    
    },
  }

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File(options.file),
        new CloudWatchTransport({
            logGroupName: 'csye6225',
            logStreamName: 'webapp',
            awsRegion: process.env.AWS_REGION || 'us-east-1'
        })
    ]
});

module.exports = logger;