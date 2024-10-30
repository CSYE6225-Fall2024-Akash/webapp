const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const path = require('path');
const auth = require('../middleware/auth');
const Image = require('../models/Image');
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

const uploadMiddleware = (req, res, next) => {
    upload(req, res, function(err) {
        console.log('Request headers:', req.headers); // Debug log
        console.log('Request file:', req.file); // Debug log

        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).send();
        } else if (err) {
            console.error('Upload error:', err);
            return res.status(400).send();
        }
        next();
    });
};

// Add profile picture
router.post('/v1/user/self/pic', auth, upload.single('profilePic'), async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');

    try {
        if (!req.file) {
            return res.status(400).send("No file");
        }

        // Check if user already has a profile picture
        const existingImage = await Image.findOne({
            where: { user_id: req.user.id }
        });

        if (existingImage) {
            return res.status(400).send("exisiting image");
        }

        const fileExtension = path.extname(req.file.originalname);
        const key = `${req.user.id}${fileExtension}`;

        // Upload to S3
        await s3.putObject({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        }).promise();

        // Create database record
        const image = await Image.create({
            file_name: req.file.originalname,
            url: `${process.env.S3_BUCKET_NAME}/${key}`,
            user_id: req.user.id
        });

        return res.status(201).json({
            file_name: image.file_name,
            id: image.id,
            url: image.url,
            upload_date: image.upload_date,
            user_id: image.user_id
        });
    } catch (error) {
        console.error(error);
        return res.status(400).send("Request processing error");
    }
});

// Get profile picture
router.get('/v1/user/self/pic', auth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');
    
    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined) {
        return res.status(400).send();
    }

    try {
        const image = await Image.findOne({
            where: { user_id: req.user.id }
        });

        if (!image) {
            return res.status(404).send();
        }

        return res.status(200).json({
            file_name: image.file_name,
            id: image.id,
            url: image.url,
            upload_date: image.upload_date,
            user_id: image.user_id
        });
    } catch (error) {
        return res.status(500).send();
    }
});

// Delete profile picture
router.delete('/v1/user/self/pic', auth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate;');
    
    if (Object.keys(req.query).length !== 0 || req._body === true || req.header('Content-length') !== undefined) {
        return res.status(400).send();
    }

    try {
        const image = await Image.findOne({
            where: { user_id: req.user.id }
        });

        if (!image) {
            return res.status(404).send();
        }

        // Delete from S3
        const key = image.url.split('/').pop();
        await s3.deleteObject({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key
        }).promise();

        // Delete from database
        await image.destroy();

        return res.status(204).send();
    } catch (error) {
        return res.status(500).send();
    }
});

module.exports = router;