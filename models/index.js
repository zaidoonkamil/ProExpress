const AddOrder = require('../models/add_order');
const User = require('../models/user');

User.hasMany(AddOrder, { foreignKey: 'userId', onDelete: 'CASCADE', as: 'statsOrders' });
AddOrder.belongsTo(User, { foreignKey: 'userId', as: 'statsUser' });

module.exports = { User, AddOrder };
