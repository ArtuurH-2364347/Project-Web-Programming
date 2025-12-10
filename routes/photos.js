import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import db, {
  getTripById,
  isGroupMember,
  createTripPhoto,
  getPhotoById,
  deleteTripPhoto,
  updatePhotoCaption
} from '../db.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID);

// Photo upload setup
const photoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'public/uploads/photos/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|heic|heif|webp/;
    const mimetype = file.mimetype.startsWith('image/');
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Upload photos to trip
router.post("/trips/:id/photos", uploadPhoto.array('photos', 10), (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const tripId = parseInt(req.params.id);
  const trip = getTripById(tripId);
  
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).send("No files uploaded");
  }

  const caption = req.body.caption || null;

  req.files.forEach((file, index) => {
    const filePath = '/uploads/photos/' + file.filename;
    const fileCaption = req.files.length === 1 ? caption : (caption ? `${caption} (${index + 1})` : null);
    
    createTripPhoto(
      tripId,
      file.filename,
      file.originalname,
      filePath,
      file.mimetype,
      file.size,
      req.session.user.id,
      fileCaption,
      'upload'
    );
  });

  res.redirect(`/trips/${tripId}?success=${req.files.length} photo(s) uploaded successfully`);
});

// View photo
router.get("/photos/:id/view", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const photoId = parseInt(req.params.id);
  const photo = getPhotoById(photoId);
  
  if (!photo) {
    return res.status(404).send("Photo not found");
  }

  const trip = getTripById(photo.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);
  
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  res.setHeader('Content-Type', photo.file_type);
  res.setHeader('Content-Disposition', 'inline; filename="' + photo.original_filename + '"');
  res.sendFile(path.join(__dirname, '..', 'public', photo.file_path));
});

// Download photo
router.get("/photos/:id/download", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const photoId = parseInt(req.params.id);
  const photo = getPhotoById(photoId);
  
  if (!photo) {
    return res.status(404).send("Photo not found");
  }

  const trip = getTripById(photo.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);
  
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  res.download(path.join(__dirname, '..', 'public', photo.file_path), photo.original_filename);
});

// Update photo caption
router.post("/photos/:id/caption", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const photoId = parseInt(req.params.id);
  const photo = getPhotoById(photoId);
  
  if (!photo) {
    return res.status(404).send("Photo not found");
  }

  const trip = getTripById(photo.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);

  if (!membership || photo.uploaded_by !== req.session.user.id) {
    return res.status(403).send("You can only edit your own photo captions");
  }

  updatePhotoCaption(photoId, req.body.caption);
  res.redirect(`/trips/${trip.id}?success=Caption updated successfully`);
});

// Delete photo
router.post("/photos/:id/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const photoId = parseInt(req.params.id);
  const photo = getPhotoById(photoId);
  
  if (!photo) {
    return res.status(404).send("Photo not found");
  }

  const trip = getTripById(photo.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);

  if (!membership || (membership.role !== 'admin' && photo.uploaded_by !== req.session.user.id)) {
    return res.status(403).send("You don't have permission to delete this photo");
  }

  if (photo.source === 'upload') {
    const filePath = path.join(__dirname, '..', 'public', photo.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  deleteTripPhoto(photoId);
  res.redirect(`/trips/${trip.id}?success=Photo deleted successfully`);
});

// Google Photos OAuth initiation
router.get("/trips/:id/connect-google-photos", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const tripId = parseInt(req.params.id);
  const trip = getTripById(tripId);
  
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  req.session.googlePhotosState = { tripId };

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('https://www.googleapis.com/auth/photoslibrary.readonly')}` +
    `&access_type=offline` +
    `&prompt=consent`;

  res.redirect(authUrl);
});

// Google Photos OAuth callback
router.get("/google-photos/callback", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const code = req.query.code;
  const tripId = req.session.googlePhotosState?.tripId;

  if (!code || !tripId) {
    return res.redirect("/trips");
  }

  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const accessToken = tokenResponse.data.access_token;

    req.session.googlePhotosToken = accessToken;
    req.session.googlePhotosTripId = tripId;

    res.redirect(`/trips/${tripId}/google-photos-picker`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect(`/trips/${tripId}?error=Failed to connect to Google Photos`);
  }
});

// Serve the Google Photos picker page
router.get("/trips/:id/google-photos-picker", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const tripId = parseInt(req.params.id);
  const accessToken = req.session.googlePhotosToken;

  if (!accessToken) {
    return res.redirect(`/trips/${tripId}?error=Session expired, please try again`);
  }

  res.render('google-photos-picker', {
    tripId,
    accessToken
  });
});

// API endpoint to fetch Google Photos
router.get("/api/google-photos", async (req, res) => {
  if (!req.session.user || !req.session.googlePhotosToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const response = await axios.get(
      'https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100',
      {
        headers: {
          'Authorization': `Bearer ${req.session.googlePhotosToken}`
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Google Photos:', error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

export default router;