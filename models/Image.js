const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const User = require('./User');

const Image = sequelize.define('Image', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    file_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    upload_date: {
        type: DataTypes.DATEONLY,
        defaultValue: DataTypes.NOW
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    }
}, {
    timestamps: false
});

// Set up association
Image.belongsTo(User, { foreignKey: 'user_id' });
User.hasOne(Image, { foreignKey: 'user_id' });

module.exports = Image;