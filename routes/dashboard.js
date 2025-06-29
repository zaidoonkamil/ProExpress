const express = require('express');
const router = express.Router();
const { User, AddOrder } = require('../models');
const { sequelize } = require('../models');

router.get('/stats', async (req, res) => {
  try {
    const totalOrders = await AddOrder.count();

    const pendingOrders = await AddOrder.count({ where: { status: "قيد الانتظار" } });
    const deliveryOrders = await AddOrder.count({ where: { status: "قيد التوصيل" } });
    const canceledOrders = await AddOrder.count({ where: { status: "راجع" } });
    const completedOrders = await AddOrder.count({ where: { status: "تم التسليم" } });

    const totalUsers = await User.count();

    const usersWithOrders = await User.count({
      include: {
        model: AddOrder,
        as: 'orders',
        required: true
      }
    });

    res.json({
      totalOrders,
      pendingOrders,
      deliveryOrders,
      canceledOrders,
      completedOrders,
      totalUsers,
      usersWithOrders
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats/:userId', async (req, res) => {
    const { userId } = req.params;
  
    try {
      const totalOrders = await AddOrder.count({ where: { userId } });
  
      const pendingOrders = await AddOrder.count({
        where: { userId, status: 'pending' },
      });
  
      const deliveryOrders = await AddOrder.count({
        where: { userId, status: 'Delivery' },
      });

      const canceledOrders = await AddOrder.count({
        where: { userId, status: 'canceled' },
      });
  
      const completedOrders = await AddOrder.count({
        where: { userId, status: 'completed' },
      });
  
      const totalAmounts = await AddOrder.findAll({
      where: { userId },
      attributes: [
          [sequelize.fn('SUM', sequelize.col('totalPrice')), 'totalOrderAmount'],
          [sequelize.fn('SUM', sequelize.col('deliveryPrice')), 'totalDeliveryAmount'],
          [sequelize.fn('SUM', sequelize.col('price')), 'totalProductAmount'],
        ],
        raw: true,
      });

    res.json({
      totalOrders,
      pendingOrders,
      deliveryOrders,
      canceledOrders,
      completedOrders,
      totalOrderAmount: totalAmounts[0].totalOrderAmount || 0,
      totalDeliveryAmount: totalAmounts[0].totalDeliveryAmount || 0,
      totalProductAmount: totalAmounts[0].totalProductAmount || 0,
    });
    } catch (error) {
      console.error('❌ Error fetching user stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/stats/delivery/:deliveryId', async (req, res) => {
  const { deliveryId } = req.params;

  try {
    const totalOrders = await AddOrder.count({ where: { deliveryId } });

    const pendingDelivery = await AddOrder.count({
      where: { deliveryId, deliveryStatus: 'في الانتظار' },
    });

    const acceptedDelivery = await AddOrder.count({
      where: { deliveryId, deliveryStatus: 'مقبول' },
    });


    const completedOrders = await AddOrder.count({
      where: { deliveryId, status: 'تم التسليم' },
    });

    const totalAmounts = await AddOrder.findOne({
      where: { deliveryId },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('totalPrice')), 'totalOrderAmount'],
        [sequelize.fn('SUM', sequelize.col('deliveryPrice')), 'totalDeliveryAmount'],
        [sequelize.fn('SUM', sequelize.col('price')), 'totalProductAmount'],
      ],
      raw: true,
    });

    res.json({
      totalOrders,
      pendingDelivery,
      acceptedDelivery,
      completedOrders,
      totalOrderAmount: totalAmounts.totalOrderAmount || 0,
      totalDeliveryAmount: totalAmounts.totalDeliveryAmount || 0,
      totalProductAmount: totalAmounts.totalProductAmount || 0,
    });

  } catch (error) {
    console.error('❌ Error fetching delivery stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;
