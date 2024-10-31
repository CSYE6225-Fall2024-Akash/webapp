const AWS = require('aws-sdk');
const path = require('path');

const s3 = new AWS.S3();

// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

const uploadToS3 = async (file, userId) => {
    if (!file || !ALLOWED_TYPES.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPG, JPEG, and PNG are allowed.');
    }

    const extension = path.extname(file.originalname).toLowerCase();
    const key = `${userId}${extension}`;

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
    };

    await s3.putObject(params).promise();

    return {
        key,
        originalName: file.originalname
    };
};

const deleteFromS3 = async (key) => {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key
    };

    await s3.deleteObject(params).promise();
};

module.exports = {
    uploadToS3,
    deleteFromS3,
    ALLOWED_TYPES
};