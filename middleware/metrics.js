const metrics = require('../utils/metrics');
const logger = require('../utils/logger');

const metricsMiddleware = (req, res, next) => {
    // Clean path for metrics
    const path = req.path.replace(/\//g, '_').substring(1);
    
    // Start API timer
    const timer = metrics.apiTimer(path);
    
    // Increment API call counter
    metrics.incrementApiCall(path);

    // Log API call
    logger.info('API Call', {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers
    });

    // Capture response time
    res.on('finish', () => {
        const duration = timer.end();
        logger.info('API Response', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration
        });
    });

    next();
};

module.exports = metricsMiddleware;