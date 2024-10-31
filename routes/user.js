const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();
const metrics = require('../utils/metrics');
const logger = require('../utils/logger');

// Regex for email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^[^\s]{5,}$/; 
const nameRegex = /^[^\s].*$/;

// Create a new user (unauthenticated route)
router.post('/v1/user', async (req, res) => {
    const apiTimer = metrics.apiTimer('create_user');
    metrics.incrementApiCall('create_user');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');  
    const { first_name, last_name, password, email } = req.body;

    if (!first_name || !last_name || !password || !email) {
        apiTimer.end();
        return res.status(400).send();
    }

    // Check if user already exists
    const dbTimer = metrics.dbTimer('check_existing_user');
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        dbTimer.end();
        return res.status(400).send();
    }

    if (!nameRegex.test(first_name) || !nameRegex.test(last_name)) {
        return res.status(400).send();
    }

    // Validate email format
    if (!emailRegex.test(email)) {
        return res.status(400).send();
    }

    if (!passwordRegex.test(password)) {
        return res.status(400).send();
    }

    // Hash the password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user in the database
    const createTimer = metrics.dbTimer('create_user_db');
    const user = await User.create({
        first_name,
        last_name,
        email,
        password_hash
    });
    createTimer.end();

    apiTimer.end();
    return res.status(201).json({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        account_created: user.account_created,
        account_updated: user.account_updated
    });
});

// Get user information (authenticated route)
router.get('/v1/user/self', auth, async (req, res) => {
    const apiTimer = metrics.apiTimer('get_user');
    metrics.incrementApiCall('get_user');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');  
    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined){
        apiTimer.end();
        return res.status(400).send(); 
    }
    const user = req.user;
    apiTimer.end();
    return res.status(200).json({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        account_created: user.account_created,
        account_updated: user.account_updated
    });
});

// Update user information (authenticated route)
router.put('/v1/user/self', auth, async (req, res) => {
    const apiTimer = metrics.apiTimer('update_user');
    metrics.incrementApiCall('update_user');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');  
    const { first_name, last_name, password, email, account_created, account_updated } = req.body;
    const user = req.user;

    if (email && email !== user.email) {
        return res.status(400).send();
    }

    if (account_created || account_updated) {
        return res.status(400).send();
    }

    // Object to hold updated fields
    const updatedFields = {};

    // Conditionally add fields to be updated if they are provided
    if (first_name) {
        if (!nameRegex.test(first_name)) {
            return res.status(400).send();
        }
        updatedFields.first_name = first_name;
    }
    if (last_name) {
        if (!nameRegex.test(last_name)) {
            return res.status(400).send();
        }
        updatedFields.last_name = last_name;
    }
    if (password) {
        if (!passwordRegex.test(password)) {
            return res.status(400).send();
        }
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        updatedFields.password_hash = password_hash;
    }

    // If no fields are provided, return 400
    if (Object.keys(updatedFields).length === 0) {
        return res.status(400).send();
    }

    // Update the user with the provided fields and set account_updated
    updatedFields.account_updated = new Date();

    const dbTimer = metrics.dbTimer('update_user_db');
    await user.update(updatedFields);
    dbTimer.end();

    apiTimer.end();

    return res.status(204).send();  // No content response
});

module.exports = router;
