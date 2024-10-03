const express = require('express');
const sequelize = require('./models/index');
const userRoutes = require('./routes/user');
const app = express();
const config = require('./config');

app.use(express.json());

app.use('/healthz', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');  
    
    if (req.method !== 'GET') {
        return res.status(405).send();  // Respond with 405 Method Not Allowed
    }

    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined){
        return res.status(400).send();  // Respond with 400 Bad Request if payload is present
    }

    // Ensure that only `/healthz` is checked and not sub-paths like `/healthz/*`
    if (req.path !== '/') {
        return res.status(404).send();  // Respond with 404 Not Found for invalid sub-paths
    }
    
    try {
        await sequelize.authenticate(); 
        res.status(200).send(''); 
    } catch (error) {
        res.status(503).send('');
    }
});



app.use(userRoutes);

app.use((req, res) => {
    if (req.path !== '/healthz') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;'); 
        return res.status(404).send();  // Respond with 404 Not Found for any other endpoints
    }
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
        console.error(error);
        process.exit(1);
    }
};

startServer();
