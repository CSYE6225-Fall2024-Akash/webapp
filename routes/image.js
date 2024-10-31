const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const path = require('path');
const auth = require('../middleware/auth');
const Image = require('../models/Image');
const metrics = require('../utils/metrics');
const logger = require('../utils/logger');
const router = express.Router();

// Configure S3
const s3 = new AWS.S3();

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function(req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Only jpeg, jpg and png files are allowed!'), false);
        }
        cb(null, true);
    }
});


// Add profile picture
router.post('/v1/user/self/pic', auth, upload.single('profilePic'), async (req, res) => {
    const apiTimer = metrics.apiTimer('upload_profile_pic');
    metrics.incrementApiCall('upload_profile_pic');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');


    logger.info('Profile picture upload attempt', {
        userId: req.user.id
    });

    try {
        if (!req.file) {
            logger.warn('Profile picture upload failed: No file provided', {
                userId: req.user.id
            });
            apiTimer.end();
            return res.status(400).send();
        }

        // Check if user already has a profile picture
        const dbTimer = metrics.dbTimer('find_existing_image');
        const existingImage = await Image.findOne({
            where: { user_id: req.user.id }
        });
        dbTimer.end();

        if (existingImage) {
            logger.warn('Profile picture upload failed: User already has a profile picture', {
                userId: req.user.id
            });
            apiTimer.end();
            return res.status(400).send();
        }

        const fileExtension = path.extname(req.file.originalname);
        const key = `${req.user.id}${fileExtension}`;

        // S3 operation timer
        const s3Timer = metrics.s3Timer('upload_image');
        await s3.putObject({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        }).promise();
        s3Timer.end();


        logger.info('File uploaded to S3 successfully', {
            userId: req.user.id,
            fileName: req.file.originalname
        });

        // Database creation timer
        const createTimer = metrics.dbTimer('create_image');
        const image = await Image.create({
            file_name: req.file.originalname,
            url: `${process.env.S3_BUCKET_NAME}/${key}`,
            user_id: req.user.id
        });
        createTimer.end();

        logger.info('Profile picture uploaded successfully', {
            userId: req.user.id,
            imageId: image.id
        });

        apiTimer.end();
        return res.status(201).json({
            file_name: image.file_name,
            id: image.id,
            url: image.url,
            upload_date: image.upload_date,
            user_id: image.user_id
        });
    } catch (error) {
        apiTimer.end();
        logger.error('Image upload error:', error);
        return res.status(400).send();
    }
});

// Get profile picture
router.get('/v1/user/self/pic', auth, async (req, res) => {
    const apiTimer = metrics.apiTimer('get_profile_pic');
    metrics.incrementApiCall('get_profile_pic');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');

    logger.info('Get profile picture attempt', {
        userId: req.user.id
    });
    
    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined) {
        logger.warn('Get profile picture failed: Invalid request parameters', {
            userId: req.user.id
        });
        apiTimer.end();
        return res.status(400).send();
    }

    try {
        const dbTimer = metrics.dbTimer('find_profile_pic');
        const image = await Image.findOne({
            where: { user_id: req.user.id }
        });
        dbTimer.end();

        if (!image) {
            logger.info('Profile picture not found', {
                userId: req.user.id
            });
            apiTimer.end();
            return res.status(404).send();
        }

        logger.info('Profile picture retrieved successfully', {
            userId: req.user.id,
            imageId: image.id
        });

        apiTimer.end();
        return res.status(200).json({
            file_name: image.file_name,
            id: image.id,
            url: image.url,
            upload_date: image.upload_date,
            user_id: image.user_id
        });
    } catch (error) {
        logger.error('Get profile picture failed', {
            userId: req.user.id,
            error: error.message
        });
        apiTimer.end();
        return res.status(500).send();
    }
});

// Delete profile picture
router.delete('/v1/user/self/pic', auth, async (req, res) => {
    const apiTimer = metrics.apiTimer('delete_profile_pic');
    metrics.incrementApiCall('delete_profile_pic');

    logger.info('Delete profile picture attempt', {
        userId: req.user.id
    });
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');
    
    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined) {
        logger.warn('Delete profile picture failed: Invalid request parameters', {
            userId: req.user.id
        });
        apiTimer.end();
        return res.status(400).send();
    }

    try {
        const dbTimer = metrics.dbTimer('find_image_for_delete');
        const image = await Image.findOne({
            where: { user_id: req.user.id }
        });
        dbTimer.end();

        if (!image) {
            logger.info('Profile picture not found for deletion', {
                userId: req.user.id
            });
            apiTimer.end();
            return res.status(404).send();
        }

        // Delete from S3
        const s3Timer = metrics.s3Timer('delete_image');
        const key = image.url.split('/').pop();
        await s3.deleteObject({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key
        }).promise();
        s3Timer.end();

        logger.info('Image deleted from S3 successfully', {
            userId: req.user.id,
            key: key
        });

        // Delete from database
        const deleteTimer = metrics.dbTimer('delete_image_db');
        await image.destroy();
        deleteTimer.end();

        logger.info('Profile picture deleted successfully', {
            userId: req.user.id,
            imageId: image.id
        });

        apiTimer.end();
        return res.status(204).send();
    } catch (error) {
        logger.error('Delete profile picture failed', {
            userId: req.user.id,
            error: error.message
        });
        apiTimer.end();
        return res.status(500).send();
    }
});

module.exports = router;