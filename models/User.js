const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const sequelizeTokenify = require('sequelize-tokenify');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    first_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    last_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password_hash: {
        type: DataTypes.STRING,
        allowNull: false
    },
    account_created: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    account_updated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    verificationToken: {
        type: DataTypes.STRING,
        unique: true
    },
    emailSentTimeStamp: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    },
    expiryTimeStamp: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    }
}, {
    timestamps: false
});

sequelizeTokenify.tokenify(User, {
    field: 'verificationToken',
    length: 20
});

module.exports = User;
