import express from "express";
import session from "express-session";
import path from 'path';
import { fileURLToPath } from 'url';
import { InitializeDatabase } from "./db.js";

// Import route modules
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import friendRoutes from './routes/friends.js';
import groupRoutes from './routes/groups.js';
import tripRoutes from './routes/trips.js';
import activityRoutes from './routes/activities.js';
import attachmentRoutes from './routes/attachments.js';
import scheduleRoutes from './routes/schedule.js';

const app = express();
const port = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// View engine setup
app.set("view engine", "ejs");
app.set("views", "./views");

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug logging middleware
app.use((request, response, next) => {
  console.log(
    `Request URL: ${request.url} @ ${new Date().toLocaleString("nl-BE")}`
  );
  next();
});

// Session setup
app.use(
  session({
    secret: "some-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// Homepage route
app.get("/", (request, response) => {
  response.render("index", { user: request.session.user });
});

// Mount route modules
app.use(authRoutes);
app.use(profileRoutes);
app.use(friendRoutes);
app.use(scheduleRoutes);
app.use(groupRoutes);
app.use(tripRoutes);
app.use(activityRoutes);
app.use(attachmentRoutes);

// console.log('All routes mounted.');

// 404 handler
app.use((request, response, next) => {
  response.status(404).render("404", { 
    user: request.session.user || null 
  });
});

// Error handler
app.use((error, request, response, next) => {
  console.error(error.stack);
  response.status(500).render("500", { 
    user: request.session.user || null 
  });
});

// Start server
InitializeDatabase();
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});