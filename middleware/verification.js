const logger = require('../utils/logger');

const checkVerification = async (req, res, next) => {
    // Skip verification check for these endpoints
    if (req.path === '/v1/user' || 
        req.path === '/v1/verify' || 
        req.path === '/healthz') {
        return next();
    }

    const user = req.user;
    if (!user.isVerified) {
        logger.warn('Access denied: User not verified', { userId: user.id });
        return res.status(403).send();
    }
    next();
};

module.exports = { checkVerification };