import express from 'express';
import multer from 'multer';
import path from 'path';
import db, { getFriends, getPendingRequests } from '../db.js';

const router = express.Router();

// Profile picture upload setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/profiles/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Profile page
router.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const friends = getFriends(req.session.user.id);
  const requests = getPendingRequests(req.session.user.id);

  res.render("profile", {
    user: req.session.user,
    name: req.session.user.name,
    email: req.session.user.email,
    bio: req.session.user.bio,
    friends: friends,
    requests: requests,
    message: null
  });
});

// Edit profile page
router.get("/edit-profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  res.render("edit-profile", {
    user: req.session.user
  });
});

// Handle editing profile
router.post("/edit-profile", upload.single('profilePicture'), (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const { name, bio, removeProfilePicture } = req.body;
  const userId = req.session.user.id;

  let profilePicture = req.session.user.profile_picture;
  
  if (removeProfilePicture === 'on') {
    profilePicture = null;
  } else if (req.file) {
    profilePicture = '/uploads/profiles/' + req.file.filename;
  }

  const stmt = db.prepare("UPDATE users SET name = ?, bio = ?, profile_picture = ? WHERE id = ?");
  stmt.run(name, bio, profilePicture, userId);

  req.session.user.name = name;
  req.session.user.bio = bio;
  req.session.user.profile_picture = profilePicture;

  res.redirect("/profile");
});

export default router;