const express = require("express");
const router = express.Router();
const { AddOrder, User } = require("../models");
const { sendNotificationToUser } = require("../services/notifications");
const multer = require("multer");
const upload = multer();


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

router.put("/assign-order/:orderId", async (req, res) => {
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

router.put("/order-response/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ["مقبول", "مرفوض"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "حالة غير صالحة، اختر مقبول أو مرفوض فقط" });
    }

    const order = await AddOrder.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    if (order.deliveryId !== req.user.id) {
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

    if (req.user.id != deliveryId) {
      return res.status(403).json({ error: "ليس لديك صلاحية لعرض هذه الطلبات" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    const orders = await AddOrder.findAndCountAll({
      where: { deliveryId },
      limit,
      offset,
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
      orders: orders.rows,
      pagination: {
        totalOrders: orders.count,
        currentPage: page,
        totalPages: Math.ceil(orders.count / limit),
      },
    });

  } catch (error) {
    console.error("❌ Error fetching delivery orders:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب الطلبات", error: error.message });
  }
});

router.put("/orders/remove-from-delivery/:deliveryId", async (req, res) => {
  try {
    const { deliveryId } = req.params;

    // تحقق من وجود الدلفري (اختياري)
    const deliveryUser = await User.findByPk(deliveryId);
    if (!deliveryUser || deliveryUser.role !== "delivery") {
      return res.status(404).json({ message: "الدلفري غير موجود أو ليس دلفري" });
    }

    // تحديث الطلبات المرتبطة بهذا الدلفري
    const [affectedRows] = await AddOrder.update(
      {
        deliveryId: null,
        deliveryStatus: "في الانتظار"
      },
      {
        where: { deliveryId }
      }
    );

    res.status(200).json({
      message: `تم إزالة ${affectedRows} طلب/طلبات من هذا الدلفري وإعادتها إلى في الانتظار`
    });

  } catch (error) {
    console.error("❌ خطأ أثناء إزالة الطلبات من الدلفري:", error);
    res.status(500).json({ message: "حدث خطأ أثناء إزالة الطلبات من الدلفري", error: error.message });
  }
});

router.get("/orders/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

     const page = parseInt(req.query.page) || 1;
     const limit = parseInt(req.query.limit) || 5;
     const offset = (page - 1) * limit;

        
    const userWithOrders = await User.findByPk(userId, {
        attributes: { exclude: ["password"] },
      include: [
        {
          model: AddOrder,
          as: "orders", 
          limit: limit,
          offset: offset, 
          order: [["createdAt", "DESC"]], 
        },
      ],
    });

    if (!userWithOrders) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const totalOrders = await AddOrder.count({ where: { userId } });

    res.status(200).json({
      user: userWithOrders,
      pagination: {
        totalOrders,
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
      },
    });
    } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ message: "Failed to fetch orders", error: error.message });
  }
});

router.delete("/orders/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    const deletedOrders = await AddOrder.destroy({
      where: { userId }
    });

    res.status(200).json({
      message: `تم حذف ${deletedOrders} طلب/طلبات لهذا المستخدم`
    });

  } catch (error) {
    console.error("❌ خطأ أثناء حذف الطلبات:", error);
    res.status(500).json({ message: "حدث خطأ أثناء حذف الطلبات", error: error.message });
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