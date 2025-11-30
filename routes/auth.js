import express from 'express';
import bcrypt from 'bcrypt';
import { getUserByEmail, createUser } from '../db.js';

const router = express.Router();

// Login page
router.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/profile");
  }
  res.render("login", { user: null });
});

// Login form
router.post("/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  
  const user = getUserByEmail(email);

  if (!user) {
    return res.status(400).send("<h3>User not found. <a href='/login'>Try again</a></h3>");
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).send("<h3>Incorrect password. <a href='/login'>Try again</a></h3>");
  }

  req.session.user = user;
  res.redirect("/profile");
});

// Register page
router.get("/register", (req, res) => {
  if (req.session.user) {
    return res.redirect("/profile");
  }
  res.render("register", { user: null });
});

// Registration form
router.post("/register", async (req, res) => {
  const { name, email, password, bio } = req.body;

  const existingUser = getUserByEmail(email);
  if (existingUser) {
    return res.redirect("/register?error=" + encodeURIComponent("Email already in use. Please try a different email address."));
  }

  try {
    createUser(name, email, password, bio || "");
    res.redirect("/login?success=" + encodeURIComponent("Account created successfully! Please log in."));
  } catch (error) {
    console.error(error);
    res.redirect("/register?error=" + encodeURIComponent("Registration failed. Please try again later."));
  }
});

// Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

export default router;