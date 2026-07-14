const express = require("express");
const http = require('http');
const cors = require("cors");
require("dotenv").config();
const socketManager = require('./utils/socket')
const path = require("path");

const app = express();
const server = http.createServer(app);

socketManager.init(server);

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const siteLinks = require("./routes/sitelink.routes");
const applicationRoutes = require("./routes/application.routes");
const branchRoutes = require('./routes/branch.routes');
const dropdownMenu = require('./routes/dropdown.routes');
const workflow = require("./routes/workflow.routes");
const serviceRoutes = require("./routes/service.routes"); 
const paymentRoutes = require("./routes/payment.routes");
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');


app.use(cors());
app.use(express.json());

require("./config/db");

app.get("/", (req, res) => {
  res.json({ message: "Backend API is running securely." });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use('/api/site-links', siteLinks);
app.use("/api/applications", applicationRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/dropdowns', dropdownMenu);
app.use('/api/workflow', workflow);
app.use('/api/payments', paymentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

app.use(
    "/uploads",
    express.static(path.join(__dirname, "../uploads"))
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});