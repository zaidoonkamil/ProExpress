const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Ads = sequelize.define("Ads", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    images: {
        type: DataTypes.JSON,
        allowNull: false
      },
}, {
    timestamps: true
});

module.exports = Ads;