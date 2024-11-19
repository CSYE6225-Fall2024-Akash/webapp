const logger = require('../utils/logger');

const checkVerification = async (req, res, next) => {
    const user = req.user;
    if (!user.isVerified) {
        logger.warn('Access denied: User not verified', { userId: user.id });
        return res.status(403).send();
    }
    next();
};

module.exports = { checkVerification };