const express = require("express");
const sequelize = require("./config/db");
const usersRouter = require("./routes/user");
const addOrdersRouter = require("./routes/add_order");
const orderRouter = require('./routes/order');
const adsRoutes = require("./routes/ads");
const dashboardRoutes = require("./routes/dashboard.js");
const notifications = require("./routes/notifications.js");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: "*"
}));

app.use(express.json());
app.use("/uploads", express.static("./" + "uploads"));
sequelize.sync({  alter: true })
    .then(() => console.log("✅ Database & User table synced!"))
    .catch(err => console.error("❌ Error syncing database:", err));


app.use("/", usersRouter);
app.use("/", addOrdersRouter);
app.use("/", orderRouter);
app.use("/", adsRoutes);
app.use("/", dashboardRoutes);
app.use("/", notifications);


app.listen( 5000 , () => {
    console.log(`🚀 Server running on http://localhost:5000`);
});
