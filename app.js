const express = require('express');
const sequelize = require('./models/index');
const userRoutes = require('./routes/user');
const imageRoutes = require('./routes/image');
const auth = require('./middleware/auth');
const { checkVerification } = require('./middleware/verification');
const app = express();
const config = require('./config');
const metricsMiddleware = require('./middleware/metrics');
const logger = require('./utils/logger');
const metrics = require('./utils/metrics');

app.use(metricsMiddleware);
app.use(express.json());

app.use('/healthz', async (req, res) => {
    const apiTimer = metrics.apiTimer('healthz');
    metrics.incrementApiCall('healthz');

    logger.info('Health check initiated');

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');  
    
    if (req.method !== 'GET') {
        logger.warn('Health check failed: Invalid HTTP method');
        apiTimer.end();
        return res.status(405).send();  // Respond with 405 Method Not Allowed
    }

    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined){
        logger.warn('Health check failed: Invalid request parameters');
        apiTimer.end();
        return res.status(400).send();  // Respond with 400 Bad Request if payload is present
    }

    // Ensure that only `/healthz` is checked and not sub-paths like `/healthz/*`
    if (req.path !== '/') {
        logger.warn('Health check failed: Invalid path');
        apiTimer.end();
        return res.status(404).send();  // Respond with 404 Not Found for invalid sub-paths
    }
    
    try {
        const dbTimer = metrics.dbTimer('health_check_db');
        await sequelize.authenticate(); 
        dbTimer.end();
        logger.info('Health check successful');
        apiTimer.end();
        res.status(200).send(''); 
    } catch (error) {
        apiTimer.end();
        res.status(503).send('');
    }
});

app.use(checkVerification);

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
