const express = require('express');
const sequelize = require('./models/index');
const userRoutes = require('./routes/user');
const imageRoutes = require('./routes/image');
const app = express();
const config = require('./config');
const metricsMiddleware = require('./middleware/metrics');
const logger = require('./utils/logger');

app.use(metricsMiddleware);
app.use(express.json());

app.use('/healthz', async (req, res) => {
    // Start API timer and increment counter
    const apiTimer = metrics.apiTimer('healthz');
    metrics.incrementApiCall('healthz');

    logger.info('Health check initiated', {
        path: '/healthz',
        method: req.method,
        requestPath: req.path
    });

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');  
    
    if (req.method !== 'GET') {
        logger.warn('Health check failed: Invalid HTTP method', {
            method: req.method,
            expectedMethod: 'GET'
        });
        apiTimer.end();
        return res.status(405).send();
    }

    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined) {
        logger.warn('Health check failed: Invalid request parameters', {
            hasQuery: Object.keys(req.query).length > 0,
            hasBody: req._body,
            hasContentLength: req.header('Content-length') !== undefined
        });
        apiTimer.end();
        return res.status(400).send();
    }

    if (req.path !== '/') {
        logger.warn('Health check failed: Invalid path', {
            path: req.path,
            expectedPath: '/'
        });
        apiTimer.end();
        return res.status(404).send();
    }
    
    try {
        // Database connection check with timing
        const dbTimer = metrics.dbTimer('health_check_db');
        await sequelize.authenticate();
        dbTimer.end();

        logger.info('Health check successful', {
            status: 'healthy',
            responseTime: apiTimer.end()
        });

        res.status(200).send('');
    } catch (error) {
        logger.error('Health check failed: Database connection error', {
            error: error.message,
            stack: error.stack
        });
        
        apiTimer.end();
        res.status(503).send('');
    }
});



app.use(userRoutes);
app.use(imageRoutes);

app.use((req, res) => {
    if (req.path !== '/healthz') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;'); 
        return res.status(404).send();  // Respond with 404 Not Found for any other endpoints
    }
});

app.use((err, req, res, next) => {
    logger.error('Application Error', {
        error: err.message,
        stack: err.stack
    });
    res.status(500).send();
});


const PORT = config.server.port;
// Synchronize database schema
const startServer = async () => {
    try {
        await sequelize.authenticate();

        // Sync models with the database schema
        await sequelize.sync({ alter: true });

        app.listen(PORT, () => {
            console.log(`Server is up and running on port ${PORT}`);
        });

    } catch (error) {
        logger.error('Server startup error:', error);
    }
};

startServer();

module.exports = { app, startServer };
