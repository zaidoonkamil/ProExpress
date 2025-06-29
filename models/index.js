const Ads = require("./ads");
const AddOrder = require("./add_order");
const User = require("./user");
const NotificationLog = require("./notification_log");
const UserDevice = require("./user_device");

User.hasMany(AddOrder, { foreignKey: 'userId', onDelete: 'CASCADE', as: 'statsOrders' });
AddOrder.belongsTo(User, { foreignKey: 'userId', as: 'statsUser' });



module.exports = { 
    User, 
    AddOrder,
    Ads,
    NotificationLog,
    UserDevice,
};
