const basicAuth = require('basic-auth');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const auth = async (req, res, next) => {
    const credentials = basicAuth(req);
    if (!credentials) {
        return res.status(401).send('');
    }

    const user = await User.findOne({ where: { email: credentials.name } });
    if (!user) {
        return res.status(401).send('');
    }

    const validPassword = await bcrypt.compare(credentials.pass, user.password_hash);
    if (!validPassword) {
        return res.status(401).send('');
    }

    req.user = user;  
    next();
};

module.exports = auth;