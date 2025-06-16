const express = require('express');
const router = express.Router();
const AddOrder = require('../models/add_order');
const User = require('../models/user');
const multer = require("multer");
const upload = multer();
const provincePrices = {
  "اطراف بغداد": 5000,
  "بغداد": 4000,
  "الموصل": 7000,
  "أربيل": 7000,
  "كربلاء": 7000,
  "النجف": 7000,
  "الناصرية": 7000,
  "السليمانية": 7000,
  "ديالى": 7000,
  "الكوت": 7000,
  "دهوك": 7000,
  "البصرة": 7000,
  "كركوك": 7000
};

router.post("/addOrder",upload.none() , async (req, res) => {
    try {
    const { userId, customerName, phoneNumber, province, address, price } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const numericPrice = parseFloat(price);
    const deliveryPrice = provincePrices[province] || 0;
    const totalPrice = numericPrice + deliveryPrice;

    const newOrder = await AddOrder.create({
      customerName,
      phoneNumber,
      status: 'pending',
      province,
      address,
      price,
      deliveryPrice,
      totalPrice,
      userId,
    });

    res.status(201).json({ message: 'Order added successfully!', order: newOrder });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add order', error: error.message });
  }
});

router.get('/provinces', (req, res) => {
  res.json(provincePrices);
});

module.exports = router;