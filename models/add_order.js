const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user');

const AddOrder = sequelize.define('AddOrder', {
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  province: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  deliveryPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  totalPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM("قيد الانتظار", "قيد التوصيل", "واصل جزئي", "راجع جزئي", "تم التسليم", "راجع"),
    allowNull: false,
    defaultValue: "قيد الانتظار"
}
}, {
  timestamps: true,
});

User.hasMany(AddOrder, { foreignKey: 'userId', onDelete: 'CASCADE' , as: "orders" });
AddOrder.belongsTo(User, { foreignKey: 'userId', as: "user" });

module.exports = AddOrder;