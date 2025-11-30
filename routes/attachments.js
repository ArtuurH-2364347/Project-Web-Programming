import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db, {
  getTripById,
  isGroupMember,
  createAttachment,
  getAttachmentById,
  deleteAttachment
} from '../db.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Attachment upload setup
const attachmentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/attachments/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'attachment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /pdf|jpg|jpeg|png|gif|doc|docx|txt/;
    const mimetype = filetypes.test(file.mimetype) || 
                     file.mimetype === 'application/pdf' ||
                     file.mimetype === 'application/msword' ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, images, and document files are allowed!'));
  }
});

// Upload attachment to activity
router.post("/activities/:id/attachments", uploadAttachment.single('attachment'), (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const activityId = parseInt(req.params.id);
  const activity = db.prepare("SELECT * FROM activities WHERE id = ?").get(activityId);
  
  if (!activity) {
    return res.status(404).send("Activity not found");
  }

  const trip = getTripById(activity.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);
  
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  if (!req.file) {
    return res.status(400).send("No file uploaded");
  }

  const filePath = '/uploads/attachments/' + req.file.filename;
  createAttachment(
    activityId,
    req.file.filename,
    req.file.originalname,
    filePath,
    req.file.mimetype,
    req.file.size,
    req.session.user.id
  );

  res.redirect(`/trips/${trip.id}?success=Attachment uploaded successfully`);
});

// View attachment
router.get("/attachments/:id/view", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const attachmentId = parseInt(req.params.id);
  const attachment = getAttachmentById(attachmentId);
  
  if (!attachment) {
    return res.status(404).send("Attachment not found");
  }

  const activity = db.prepare("SELECT * FROM activities WHERE id = ?").get(attachment.activity_id);
  const trip = getTripById(activity.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);
  
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  res.setHeader('Content-Type', attachment.file_type);
  res.setHeader('Content-Disposition', 'inline; filename="' + attachment.original_filename + '"');
  res.sendFile(path.join(__dirname, '..', 'public', attachment.file_path));
});

// Download attachment
router.get("/attachments/:id/download", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const attachmentId = parseInt(req.params.id);
  const attachment = getAttachmentById(attachmentId);
  
  if (!attachment) {
    return res.status(404).send("Attachment not found");
  }

  const activity = db.prepare("SELECT * FROM activities WHERE id = ?").get(attachment.activity_id);
  const trip = getTripById(activity.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);
  
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  res.download(path.join(__dirname, '..', 'public', attachment.file_path), attachment.original_filename);
});

// Delete attachment
router.post("/attachments/:id/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const attachmentId = parseInt(req.params.id);
  const attachment = getAttachmentById(attachmentId);
  
  if (!attachment) {
    return res.status(404).send("Attachment not found");
  }

  const activity = db.prepare("SELECT * FROM activities WHERE id = ?").get(attachment.activity_id);
  const trip = getTripById(activity.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);

  if (!membership || (membership.role !== 'admin' && attachment.uploaded_by !== req.session.user.id)) {
    return res.status(403).send("You don't have permission to delete this attachment");
  }

  const filePath = path.join(__dirname, '..', 'public', attachment.file_path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  deleteAttachment(attachmentId);
  res.redirect(`/trips/${trip.id}?success=Attachment deleted successfully`);
});

export default router;