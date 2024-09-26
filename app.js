require('dotenv').config(); 
const express = require('express');
const Sequelize = require('sequelize');
const config = require('./config/config');

// Initialize Express application
const app = express();

// Configure and initialize database connection using Sequelize and config.js settings
const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    host: config.db.host,
    dialect: config.db.dialect,
    port: config.db.port,
    logging: config.db.logging, 
});


app.use('/healthz', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');  // Ensure that the response is not cached by clients

    // Only allow GET requests for health checks
    if (req.method !== 'GET') {
        return res.status(405).send();  // Respond with 405 Method Not Allowed
    }

    // Ensure request does not contain a payload
    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined){
        return res.status(400).send();  // Respond with 400 Bad Request if payload is present
    }

    // Ensure that only `/healthz` is checked and not sub-paths like `/healthz/*`
    if (req.path !== '/') {
        return res.status(404).send();  // Respond with 404 Not Found for invalid sub-paths
    }

    try {
        // Attempt to authenticate database connection to ensure system health
        await sequelize.authenticate();
        return res.status(200).send();  // Respond with 200 OK if database is reachable
    } catch (error) {
        return res.status(503).send();  // Respond with 503 Service Unavailable if DB connection fails
    }
});

// Handle all other undefined routes, ensuring that only `/healthz` is a valid endpoint
app.use((req, res) => {
    if (req.path !== '/healthz') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;'); 
        return res.status(404).send();  // Respond with 404 Not Found for any other endpoints
    }
});

// Start server on the configured port and log the status
const PORT = config.server.port;
app.listen(PORT, () => {
    console.log(`Server is up and running on port ${PORT}`);
});
