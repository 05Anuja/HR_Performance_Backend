const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use("/uploads", express.static(path.join(__dirname, "uploads"))); //local

// Production
app.use("/uploads", express.static("/opt/data/hrmp/uploads"));

// server.js
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/silgate", require("./routes/silgateRoutes"));
app.use("/api/talent", require("./routes/talentRoutes"));
app.use("/api/designations", require("./routes/designationRoutes"));
app.use("/api/audit-logs", require("./routes/auditLogRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/interview-status", require("./routes/interviewStatusRoutes"));
app.use("/api/sources", require("./routes/sourcesRoutes"));
app.use("/api/disposition", require("./routes/dispositionRoutes"));
app.use("/api/lists", require("./routes/listRoutes"));

app.get("/", (req, res) => {
  res.send("Backend running");
});

// error handler LAST — after ALL routes
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
