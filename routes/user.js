const express = require('express');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { checkVerification } = require('../middleware/verification');
const router = express.Router();
const metrics = require('../utils/metrics');
const logger = require('../utils/logger');
const crypto = require('crypto');


AWS.config.update({
    region: process.env.AWS_REGION 
});

const sns = new AWS.SNS();

// Regex for email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^[^\s]{5,}$/; 
const nameRegex = /^[^\s].*$/;

// Create a new user (unauthenticated route)
router.post('/v1/user', async (req, res) => {
    const apiTimer = metrics.apiTimer('create_user');
    metrics.incrementApiCall('create_user');

    logger.info('User creation attempt')

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');  
    const { first_name, last_name, password, email } = req.body;

    if (!first_name || !last_name || !password || !email) {
        logger.warn('User creation failed: Missing required fields');

        apiTimer.end();
        return res.status(400).send();
    }

    // Check if user already exists
    const dbTimer = metrics.dbTimer('check_existing_user');
    const existingUser = await User.findOne({ where: { email } });
    dbTimer.end();
    if (existingUser) {
        logger.warn('User creation failed: Email already exists', { email });
        apiTimer.end();
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

    // Generate verification token and expiry
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 2 * 60000);

    // Hash the password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user in the database
    const createTimer = metrics.dbTimer('create_user_db');
    const user = await User.create({
        first_name,
        last_name,
        email,
        password_hash,
        isVerified: false,
        verificationToken: verificationToken,
        emailSentTimeStamp: now,
        expiryTimeStamp: expiryTime
    });
    createTimer.end();

    try {
        const snsTimer = metrics.s3Timer('sns_publish');
        const snsPayload = {
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            accountCreated: user.account_created,
            verificationToken: verificationToken,
            verificationUrl: `http://${process.env.DOMAIN_NAME}/v1/verify?token=${verificationToken}`
        };

        await sns.publish({
            TopicArn: process.env.USER_TOPIC_ARN,
            Message: JSON.stringify(snsPayload)
        }).promise();
        snsTimer.end();
        
        logger.info('SNS message published successfully', { userId: user.id });
    } catch (error) {
        logger.error('SNS publish error:', error);
        // Continue with user creation even if SNS fails
    }


    logger.info('User created successfully', { 
        userId: user.id,
        email: user.email 
    });
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


// Verification endpoint
router.get('/v1/verify', async (req, res) => {
    const apiTimer = metrics.apiTimer('verify_email');
    metrics.incrementApiCall('verify_email');
    
    logger.info('Email verification attempt');
    
    try {
        const { token } = req.query;
        
        if (!token) {
            logger.warn('Verification failed: Missing token');
            apiTimer.end();
            return res.status(400).send();
        }

        // Find user by verification token
        const user = await User.findOne({
            where: { 
                verificationToken: token
            }
        });

        if (!user) {
            logger.warn('Verification failed: Invalid token');
            apiTimer.end();
            return res.status(400).send();
        }

        // Check token expiration
        const now = new Date();
        if (!user.expiryTimeStamp || now > user.expiryTimeStamp) {
            logger.warn('Verification failed: Token expired');
            apiTimer.end();
            return res.status(400).json({ 
                error: 'Verification link has expired'
            });
        }

        // Update user verification status
        await user.update({
            isVerified: true,
            verificationToken: null,
            emailSentTimeStamp: null,
            expiryTimeStamp: null
        });

        logger.info('Email verified successfully', { email: user.email });
        apiTimer.end();
        return res.status(200).json({ message: 'Email verified successfully' });
    } catch (error) {
        logger.error('Email verification error:', error);
        apiTimer.end();
        return res.status(400).send();
    }
});


// Get user information (authenticated route)
router.get('/v1/user/self', auth, checkVerification, async (req, res) => {
    const apiTimer = metrics.apiTimer('get_user');
    metrics.incrementApiCall('get_user');

    logger.info('Get user profile attempt');

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');  
    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined){
        logger.warn('Get user profile failed: Invalid request parameters');
        apiTimer.end();
        return res.status(400).send(); 
    }
    const user = req.user;

    logger.info('User profile retrieved successfully');

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
router.put('/v1/user/self', auth, checkVerification, async (req, res) => {
    const apiTimer = metrics.apiTimer('update_user');
    metrics.incrementApiCall('update_user');

    logger.info('Update user profile attempt');

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');  
    const { first_name, last_name, password, email, account_created, account_updated } = req.body;
    const user = req.user;

    if (email && email !== user.email) {
        logger.warn('Update user failed: Cannot modify email');
        apiTimer.end();
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

    logger.info('User profile updated successfully', { 
        userId: user.id,
        updatedFields: Object.keys(updatedFields).filter(f => f !== 'password_hash')
    });

    apiTimer.end();

    return res.status(204).send();  // No content response
});

module.exports = router;
