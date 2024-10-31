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
            logger.warn('Image upload failed: Invalid file type', {
                fileType: file.mimetype,
                allowedTypes
            });
            return cb(new Error('Only jpeg, jpg and png files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Add profile picture
router.post('/v1/user/self/pic', auth, upload.single('profilePic'), async (req, res) => {
    const apiTimer = metrics.apiTimer('upload_profile_pic');
    metrics.incrementApiCall('upload_profile_pic');

    logger.info('Profile picture upload attempt', {
        userId: req.user.id,
        path: '/v1/user/self/pic',
        method: 'POST'
    });

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');

    try {
        if (!req.file) {
            logger.warn('Profile picture upload failed: No file provided', {
                userId: req.user.id
            });
            apiTimer.end();
            return res.status(400).send();
        }

        // Check if user already has a profile picture
        const dbCheckTimer = metrics.dbTimer('find_existing_image');
        const existingImage = await Image.findOne({
            where: { user_id: req.user.id }
        });
        dbCheckTimer.end();

        if (existingImage) {
            logger.warn('Profile picture upload failed: User already has profile picture', {
                userId: req.user.id,
                existingImageId: existingImage.id
            });
            apiTimer.end();
            return res.status(400).send();
        }

        const fileExtension = path.extname(req.file.originalname);
        const key = `${req.user.id}${fileExtension}`;

        logger.info('Uploading image to S3', {
            userId: req.user.id,
            fileName: req.file.originalname,
            fileSize: req.file.size
        });

        // S3 upload
        const s3Timer = metrics.s3Timer('upload_image');
        await s3.putObject({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        }).promise();
        s3Timer.end();

        logger.info('Successfully uploaded image to S3', {
            userId: req.user.id,
            key
        });

        // Create database record
        const dbCreateTimer = metrics.dbTimer('create_image');
        const image = await Image.create({
            file_name: req.file.originalname,
            url: `${process.env.S3_BUCKET_NAME}/${key}`,
            user_id: req.user.id
        });
        dbCreateTimer.end();

        logger.info('Profile picture uploaded successfully', {
            userId: req.user.id,
            imageId: image.id,
            fileName: image.file_name
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
        logger.error('Profile picture upload error', {
            userId: req.user.id,
            error: error.message,
            stack: error.stack
        });
        apiTimer.end();
        return res.status(400).send();
    }
});

// Get profile picture
router.get('/v1/user/self/pic', auth, async (req, res) => {
    const apiTimer = metrics.apiTimer('get_profile_pic');
    metrics.incrementApiCall('get_profile_pic');

    logger.info('Profile picture retrieval attempt', {
        userId: req.user.id,
        path: '/v1/user/self/pic',
        method: 'GET'
    });

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');
    
    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined) {
        logger.warn('Profile picture retrieval failed: Invalid request parameters', {
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
        logger.error('Profile picture retrieval error', {
            userId: req.user.id,
            error: error.message,
            stack: error.stack
        });
        apiTimer.end();
        return res.status(500).send();
    }
});

// Delete profile picture
router.delete('/v1/user/self/pic', auth, async (req, res) => {
    const apiTimer = metrics.apiTimer('delete_profile_pic');
    metrics.incrementApiCall('delete_profile_pic');

    logger.info('Profile picture deletion attempt', {
        userId: req.user.id,
        path: '/v1/user/self/pic',
        method: 'DELETE'
    });

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');
    
    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined) {
        logger.warn('Profile picture deletion failed: Invalid request parameters', {
            userId: req.user.id
        });
        apiTimer.end();
        return res.status(400).send();
    }

    try {
        const dbFindTimer = metrics.dbTimer('find_image_for_delete');
        const image = await Image.findOne({
            where: { user_id: req.user.id }
        });
        dbFindTimer.end();

        if (!image) {
            logger.info('Profile picture not found for deletion', {
                userId: req.user.id
            });
            apiTimer.end();
            return res.status(404).send();
        }

        // Delete from S3
        const key = image.url.split('/').pop();
        const s3Timer = metrics.s3Timer('delete_image');
        await s3.deleteObject({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key
        }).promise();
        s3Timer.end();

        logger.info('Successfully deleted image from S3', {
            userId: req.user.id,
            key
        });

        // Delete from database
        const dbDeleteTimer = metrics.dbTimer('delete_image');
        await image.destroy();
        dbDeleteTimer.end();

        logger.info('Profile picture deleted successfully', {
            userId: req.user.id,
            imageId: image.id
        });

        apiTimer.end();
        return res.status(204).send();
    } catch (error) {
        logger.error('Profile picture deletion error', {
            userId: req.user.id,
            error: error.message,
            stack: error.stack
        });
        apiTimer.end();
        return res.status(500).send();
    }
});

module.exports = router;