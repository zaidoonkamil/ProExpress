const express = require('express');
const router = express.Router();
const AddOrder = require('../models/add_order');
const User = require('../models/user');
const multer = require("multer");
const upload = multer();
const { sendNotificationToRoleWithoutLog } = require('../services/notifications');


const provincePrices = {
  "بغداد": 6000,
  "البصرة": 6000,
  "الموصل": 6000,
  "الانبار": 6000,
  "بابل": 6000,
  "واسط": 6000,
  "صلاح الدين": 6000,
  "كربلاء": 6000,
  "الديوانية": 6000,
  "ذي قار": 6000,
  "ميسان": 6000,
  "ديالى": 6000,
  "السليمانية": 6000,
  "دهوك": 6000,
  "أربيل": 6000,
  "كركوك": 6000,
  "النجف": 6000,
  "المثنى": 6000,
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
      status: "قيد الانتظار",
      province,
      address,
      price,
      deliveryPrice,
      totalPrice,
      userId,
    });

    await sendNotificationToRoleWithoutLog("admin", `طلب جديد باسم ${customerName}`, "طلب جديد");

    res.status(201).json({ message: 'Order added successfully!', order: newOrder });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add order', error: error.message });
  }
});

router.get('/provinces', (req, res) => {
  res.json(provincePrices);
});

module.exports = router;