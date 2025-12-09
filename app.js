import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

import { InitializeDatabase } from "./db.js";

// Route modules (ALLEEN deze!)
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import friendRoutes from "./routes/friends.js";
import groupRoutes from "./routes/groups.js";
import tripRoutes from "./routes/trips.js";
import activityRoutes from "./routes/activities.js";
import attachmentRoutes from "./routes/attachments.js";
import scheduleRoutes from "./routes/schedule.js";
import adminRoutes from "./routes/admin.js";
import pdfRoutes from "./routes/pdf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// --------------------------------------
// VIEW ENGINE + PUBLIC
// --------------------------------------
app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// --------------------------------------
// SESSION
// --------------------------------------
app.use(
  session({
    secret: "some-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// --------------------------------------
// GLOBAL LOCALS
// --------------------------------------
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.message = req.query.message || null;
  next();
});

// --------------------------------------
// HOMEPAGE
// --------------------------------------
app.get("/", (req, res) => {
  res.render("index", { user: req.session.user });
});

// --------------------------------------
// ROUTES
// --------------------------------------
app.use(authRoutes);
app.use(profileRoutes);
app.use(friendRoutes);
app.use(scheduleRoutes);
app.use(groupRoutes);
app.use(tripRoutes);
app.use(activityRoutes);
app.use(attachmentRoutes);
app.use(adminRoutes);
app.use(pdfRoutes);

// --------------------------------------
// ERROR HANDLING
// --------------------------------------
app.use((req, res) => {
  res.status(404).render("404");
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("500");
});

// --------------------------------------
// START SERVER
// --------------------------------------
InitializeDatabase();
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
