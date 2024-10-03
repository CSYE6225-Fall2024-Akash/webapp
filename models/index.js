const { Sequelize } = require('sequelize');
const config = require('../config');

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    host: config.db.host,
    dialect: config.db.dialect,
    port: config.db.port,
    logging: config.db.logging, 
});

module.exports = sequelize;