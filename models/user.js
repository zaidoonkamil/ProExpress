const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define("User", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM("user", "admin"), 
        allowNull: false,
        defaultValue: "user",
    }
}, {
    timestamps: true,
});
/*
User.hasMany(AddOrder, { foreignKey: 'userId', onDelete: 'CASCADE', as: 'orders' });
AddOrder.belongsTo(User, { foreignKey: 'userId' });*/
module.exports = User;
