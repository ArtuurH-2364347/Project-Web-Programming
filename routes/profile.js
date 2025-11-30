import express from 'express';
import multer from 'multer';
import path from 'path';
import db, { getFriends, getPendingRequests } from '../db.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'profilePicture') {
      cb(null, 'public/uploads/profiles/');
    } else if (file.fieldname === 'bannerImage') {
      cb(null, 'public/uploads/banners/');
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const prefix = file.fieldname === 'profilePicture' ? 'profile-' : 'banner-';
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
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
router.post("/edit-profile", upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]), (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const { name, bio, removeProfilePicture, removeBannerImage } = req.body;
  const userId = req.session.user.id;

  let profilePicture = req.session.user.profile_picture;
  let bannerImage = req.session.user.banner_image;

  // Handle profile picture
  if (removeProfilePicture === 'on') {
    profilePicture = null;
  } else if (req.files && req.files['profilePicture']) {
    profilePicture = '/uploads/profiles/' + req.files['profilePicture'][0].filename;
  }

  // Handle banner image
  if (removeBannerImage === 'on') {
    bannerImage = null;
  } else if (req.files && req.files['bannerImage']) {
    bannerImage = '/uploads/banners/' + req.files['bannerImage'][0].filename;
  }

  // Update database with both fields
  const stmt = db.prepare("UPDATE users SET name = ?, bio = ?, profile_picture = ?, banner_image = ? WHERE id = ?");
  stmt.run(name, bio, profilePicture, bannerImage, userId);

  // Update session
  req.session.user.name = name;
  req.session.user.bio = bio;
  req.session.user.profile_picture = profilePicture;
  req.session.user.banner_image = bannerImage;

  res.redirect("/profile");
});

export default router;