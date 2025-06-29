const AddOrder = require('../models/add_order');
const User = require('../models/user');
const Ads = require('../models/ads');
const NotificationLog = require('../models/notification_log');
const UserDevice = require('../models/user_device');

User.hasMany(AddOrder, { foreignKey: 'userId', onDelete: 'CASCADE', as: 'statsOrders' });
AddOrder.belongsTo(User, { foreignKey: 'userId', as: 'statsUser' });



module.exports = { 
    User, 
    AddOrder,
    Ads,
    NotificationLog,
    UserDevice,
};
