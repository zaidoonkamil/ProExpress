const express = require("express");
const router = express.Router();
const { AddOrder, User } = require("../models");
const { sendNotificationToUser } = require("../services/notifications");
const multer = require("multer");
const upload = multer();
const { Op } = require("sequelize");
const PDFDocument = require('pdfkit');
const path = require('path');
const arabicReshaper = require('arabic-persian-reshaper');
const bidi = require('bidi-js');

router.get("/orders/:orderId/admin", async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await AddOrder.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    res.status(200).json({ order });

  } catch (error) {
    console.error("❌ Error fetching order:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب الطلب", error: error.message });
  }
});

router.get("/orders/:orderId/user/:userId", async (req, res) => {
  try {
    const { orderId, userId } = req.params;

    const order = await AddOrder.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    if (order.userId !== parseInt(userId)) {
      return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذا الطلب" });
    }

    res.status(200).json({ order });

  } catch (error) {
    console.error("❌ Error fetching order:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب الطلب", error: error.message });
  }
});

router.get("/orders/print/pdf/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).send("المستخدم غير موجود");


    const orders = await AddOrder.findAll({
  where: {
    userId: userId,
    status: { 
      [Op.notIn]: ["قيد الانتظار", "قيد التوصيل", "راجع", "راجع جزئي"]
    }
  },
  order: [["createdAt", "DESC"]],
});



    if (!orders.length) return res.send("لا توجد طلبات صالحة للطباعة لهذا المستخدم.");

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=orders_${user.name}_${Date.now()}.pdf`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");

    doc.pipe(res);

    const fontPath = path.join(__dirname, "..", "fonts", "Cairo-Bold.ttf");
    doc.registerFont("ArabicFont", fontPath);

    function fixArabicText(text) {
      try {
        const reshaped = arabicReshaper.reshape(text);
        return bidi.getVisualString(reshaped);
      } catch {
        return text;
      }
    }

    doc.font("ArabicFont").fontSize(20).text(fixArabicText(`${user.name} : المستخدم طلبات `), { align: "center" });
    doc.moveDown(1);

    orders.forEach((order, idx) => {
      doc.font("ArabicFont").fontSize(14);

      doc.text(`${order.id} : طلب`, { align: "right" });      
      doc.text(fixArabicText(`${order.price} : المبلغ`), { align: "right" });
      doc.text(fixArabicText(`${order.deliveryPrice} :  التوصيل سعر`), { align: "right" });
      doc.text(fixArabicText(`${order.totalPrice} : الإجمالي `), { align: "right" });

      doc.moveDown(1);

      if (idx !== orders.length - 1) {
        doc.fontSize(12).text(fixArabicText("------------------------------------------------------------"), { align: "center" });
        doc.moveDown(1);
      }
    });

        
    doc.fontSize(12).text(fixArabicText("************************************************************"), { align: "center" });

  
    doc.moveDown(1);
    doc.fontSize(16).text(fixArabicText("الطلبات ملخص"), { align: "center" });
    doc.moveDown(0.5);

const totalOrders = orders.length;
const totalDeliveryPrice = orders.reduce((sum, o) => sum + o.deliveryPrice, 0);
const totalPrice = orders.reduce((sum, o) => sum + o.price, 0);
const totalAmount = totalDeliveryPrice + totalPrice;

doc.fontSize(14)
  .text(fixArabicText(`${totalOrders} : الطلبات عدد `), { align: "right" })
  .text(fixArabicText(`${totalDeliveryPrice} : التوصيل مبلغ `), { align: "right" })
  .text(fixArabicText(`${totalPrice}  : الطلبات مبلغ `), { align: "right" })
  .text(fixArabicText(`${totalAmount} : الكلي المبلغ `), { align: "right" });

doc.end();


  } catch (error) {
    console.error("❌ خطأ أثناء توليد PDF:", error);
    res.status(500).send("حدث خطأ أثناء تجهيز ملف PDF.");
  }
});

router.put("/orders/:orderId",upload.none(), async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

const validStatuses = ["قيد الانتظار","قيد التوصيل","واصل جزئي","راجع جزئي","تم التسليم","راجع"];
  if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const order = await AddOrder.findByPk(orderId);
    if (!order) {
          return res.status(404).json({ error: "Order not found" });
      }

      const currentStatus = order.status;

      await order.update({ status });

      await sendNotificationToUser(order.userId, `تم تحديث حالة طلبك إلى ${status}`, "تحديث الطلب");

      res.status(200).json({
          message: `Order status updated from ${currentStatus} to ${status}`,
          order
      });

  } catch (err) {
      console.error("❌ Error updating order status:", err);
      res.status(500).json({ error: "An error occurred while updating the order status" });
  }
});

router.put("/assign-order/:orderId", upload.none(), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryId } = req.body;

    const order = await AddOrder.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    const deliveryUser = await User.findByPk(deliveryId);
    if (!deliveryUser || deliveryUser.role !== "delivery") {
      return res.status(404).json({ message: "الدلفري غير موجود أو ليس دلفري" });
    }

    await order.update({
      deliveryId: deliveryId,
      deliveryStatus: "في الانتظار",
    });

    await sendNotificationToUser(deliveryId, "طلب جديد بانتظارك", "طلب جديد تم توجيهه إليك");

    res.status(200).json({
      message: `تم توجيه الطلب رقم ${orderId} إلى الدلفري ${deliveryUser.name}`,
      order,
    });

  } catch (error) {
    console.error("❌ Error assigning order:", error);
    res.status(500).json({ message: "حدث خطأ أثناء توجيه الطلب", error: error.message });
  }
});

router.put("/order-response/:orderId", upload.none(), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, deliveryId } = req.body;

    const validStatuses = ["مقبول", "مرفوض"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "حالة غير صالحة، اختر مقبول أو مرفوض فقط" });
    }

    if (!deliveryId) {
      return res.status(400).json({ error: "يجب إرسال deliveryId" });
    }

    const order = await AddOrder.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    if (order.deliveryId !== parseInt(deliveryId)) {
      return res.status(403).json({ error: "ليس لديك صلاحية لهذا الطلب" });
    }

    if (order.deliveryStatus !== "في الانتظار") {
      return res.status(400).json({ error: "لا يمكن تعديل الطلب إلا في حالة الانتظار" });
    }

    if (status === "مرفوض") {
      await order.update({
        deliveryStatus: "في الانتظار",
        deliveryId: null,
        status: "قيد الانتظار"
      });
      return res.status(200).json({ message: "تم رفض الطلب وإعادته إلى قائمة الانتظار" });
    } else if (status === "مقبول") {
      await order.update({ deliveryStatus: "مقبول" });
      return res.status(200).json({ message: "تم قبول الطلب بنجاح" });
    }

    res.status(200).json({ message: `تم تحديث حالة الطلب إلى ${status}` });

  } catch (error) {
    console.error("❌ Error updating delivery response:", error);
    res.status(500).json({ message: "حدث خطأ أثناء تحديث حالة الطلب", error: error.message });
  }
});


router.get("/delivery-orders/:deliveryId", async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const orders = await AddOrder.findAll({
      where: { deliveryId },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    res.status(200).json({
      orders: orders,
    });

  } catch (error) {
    console.error("❌ Error fetching delivery orders:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب الطلبات", error: error.message });
  }
});


router.delete("/orders/remove/:id", upload.none(), async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    if (!type || (type !== "user" && type !== "delivery")) {
      return res.status(400).json({ message: "حدد نوع الحذف: type=user أو type=delivery" });
    }

    if (type === "user") {
      const affectedOrders = await AddOrder.findAll({
        where: { 
          userId: id,
           status: { [Op.ne]: ["قيد الانتظار", "قيد التوصيل"] }
           }
      });

      let deletedCount = 0;

      for (const order of affectedOrders) {
        if (order.deliveryId === null) {
          await order.destroy();
          deletedCount++;
        } else {
          await order.update({ userId: null });
        }
      }

      return res.status(200).json({
        message: `تم حذف ${deletedCount} طلب/طلبات تخص هذا المستخدم`
      });

    } else if (type === "delivery") {
      const affectedOrders = await AddOrder.findAll({
        where: { deliveryId: id, status: { [Op.ne]: ["قيد الانتظار", "قيد التوصيل"] } }
      });

      let deletedCount = 0;

      for (const order of affectedOrders) {
        if (order.userId === null) {
          await order.destroy();
          deletedCount++;
        } else {
          await order.update({ deliveryId: null, deliveryStatus: "في الانتظار" });
        }
      }

      return res.status(200).json({
        message: `تم حذف ${deletedCount} طلب/طلبات تخص هذا الدلفري`
      });
    }

  } catch (error) {
    console.error("❌ خطأ أثناء حذف الطلبات:", error);
    res.status(500).json({ message: "حدث خطأ أثناء حذف الطلبات", error: error.message });
  }
});

router.get("/orders/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const userWithOrders = await User.findByPk(userId, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: AddOrder,
          as: "orders",
          order: [["createdAt", "DESC"]], 
        },
      ],
    });

    if (!userWithOrders) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      user: userWithOrders,
    });

  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ message: "Failed to fetch orders", error: error.message });
  }
});

router.delete("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await AddOrder.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    await order.destroy();
    res.status(200).json({ message: "Order deleted successfully!" });
  } catch (error) {
    console.error("❌ Error deleting order:", error);
    res.status(500).json({ message: "Failed to delete order", error: error.message });
  }
});

router.get("/ordersPending", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const pendingOrders = await AddOrder.findAndCountAll({
      where: { status: "قيد الانتظار" },
      limit: limit,
      offset: offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    res.status(200).json({
      orders: pendingOrders.rows,
      pagination: {
        totalOrders: pendingOrders.count,
        currentPage: page,
        totalPages: Math.ceil(pendingOrders.count / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching pending orders:", error);
    res.status(500).json({ message: "Failed to fetch pending orders", error: error.message });
  }
});

router.get("/ordersDelivery", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const pendingOrders = await AddOrder.findAndCountAll({
      where: { status: "قيد التوصيل" },
      limit: limit,
      offset: offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
         // required: true,
          attributes: { exclude: ["password"] },
        },
      ],
    });

    res.status(200).json({
      orders: pendingOrders.rows,
      pagination: {
        totalOrders: pendingOrders.count,
        currentPage: page,
        totalPages: Math.ceil(pendingOrders.count / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching pending orders:", error);
    res.status(500).json({ message: "Failed to fetch pending orders", error: error.message });
  }
});

router.get("/ordersCompleted", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const pendingOrders = await AddOrder.findAndCountAll({
      where: { status: "تم التسليم" },
      limit: limit,
      offset: offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    res.status(200).json({
      orders: pendingOrders.rows,
      pagination: {
        totalOrders: pendingOrders.count,
        currentPage: page,
        totalPages: Math.ceil(pendingOrders.count / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching pending orders:", error);
    res.status(500).json({ message: "Failed to fetch pending orders", error: error.message });
  }
});

router.get("/ordersCanceled", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const pendingOrders = await AddOrder.findAndCountAll({
      where: { status: "راجع" },
      limit: limit,
      offset: offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    res.status(200).json({
      orders: pendingOrders.rows,
      pagination: {
        totalOrders: pendingOrders.count,
        currentPage: page,
        totalPages: Math.ceil(pendingOrders.count / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching pending orders:", error);
    res.status(500).json({ message: "Failed to fetch pending orders", error: error.message });
  }
});

router.get("/ordersPartialConnection", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const pendingOrders = await AddOrder.findAndCountAll({
      where: { status: "واصل جزئي" },
      limit: limit,
      offset: offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    res.status(200).json({
      orders: pendingOrders.rows,
      pagination: {
        totalOrders: pendingOrders.count,
        currentPage: page,
        totalPages: Math.ceil(pendingOrders.count / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching pending orders:", error);
    res.status(500).json({ message: "Failed to fetch pending orders", error: error.message });
  }
});

router.get("/ordersReviewMyPart", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const pendingOrders = await AddOrder.findAndCountAll({
      where: { status: "راجع جزئي" },
      limit: limit,
      offset: offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    res.status(200).json({
      orders: pendingOrders.rows,
      pagination: {
        totalOrders: pendingOrders.count,
        currentPage: page,
        totalPages: Math.ceil(pendingOrders.count / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching pending orders:", error);
    res.status(500).json({ message: "Failed to fetch pending orders", error: error.message });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const allOrders = await AddOrder.findAndCountAll({
      limit: limit,
      offset: offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: { exclude: ["password"] },
        },
      ],
    });

    res.status(200).json({
      orders: allOrders.rows,
      pagination: {
        totalOrders: allOrders.count,
        currentPage: page,
        totalPages: Math.ceil(allOrders.count / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching all orders:", error);
    res.status(500).json({ message: "Failed to fetch all orders", error: error.message });
  }
});

module.exports = router;