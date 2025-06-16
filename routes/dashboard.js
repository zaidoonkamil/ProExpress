const express = require('express');
const router = express.Router();
const { User, AddOrder } = require('../models');

router.get('/stats', async (req, res) => {
  try {
    const totalOrders = await AddOrder.count();

    const pendingOrders = await AddOrder.count({ where: { status: 'pending' } });
    const deliveryOrders = await AddOrder.count({ where: { status: 'Delivery' } });
    const canceledOrders = await AddOrder.count({ where: { status: 'canceled' } });
    const completedOrders = await AddOrder.count({ where: { status: 'completed' } });

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
  
      res.json({
        totalOrders,
        pendingOrders,
        deliveryOrders,
        canceledOrders,
        completedOrders,
      });
    } catch (error) {
      console.error('❌ Error fetching user stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  
module.exports = router;
