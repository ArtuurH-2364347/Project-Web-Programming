import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { 
  InitializeDatabase, getUserByEmail, createUser, getFriends, 
  sendFriendRequest, getPendingRequests, acceptFriendRequest, 
  rejectFriendRequest, removeFriend, createGroup, getUserGroups,
  getGroupById, getGroupMembers, isGroupMember, updateMemberRole, removeGroupMember,
  addGroupMember, updateGroup,
  createTrip, getGroupTrips, getTripById, getTripActivities, createActivity, deleteActivity, getUserTrips,
  createActivitySuggestion, getTripSuggestions, getSuggestionVotes, getUserVote, castVote, approveSuggestion, 
  deleteSuggestion, checkActivityOverlap, deleteGroup, deleteTrip,
  createAttachment, getActivityAttachments, getAttachmentById, deleteAttachment
} from "./db.js";

const app = express();
const port = process.env.PORT || 8080; // Set by Docker Entrypoint or use 8080

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// set the view engine to ejs
// Use EJS templates
app.set("view engine", "ejs");
app.set("views", "./views");

// Middleware for serving static files
app.use(express.static("public"));

// Middleware for parsing JSON bodies
app.use(express.json());

// Middleware for debug logging
app.use((request, response, next) => {
  console.log(
    `Request URL: ${request.url} @ ${new Date().toLocaleString("nl-BE")}`
  );
  next();
});

// setup voor profile pictures
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/profiles/');
  },
  filename: function (req, file, cb) {
    // unieke filenames maken
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limiet
  fileFilter: function (req, file, cb) {
    // alleen images + gifs toelaten
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

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
    // Allow PDFs, images, and common document types
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

// session setup
app.use(
  session({
    secret: "some-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.urlencoded({ extended: true }));

// homepage
app.get("/", (request, response) => {
  response.render("index", { user: request.session.user });
});

// login page
app.get("/login", (req, res) => {
  // naar profile page gaan als al ingelogd is
  if (req.session.user) {
    return res.redirect("/profile");
  }
  res.render("login", { user: null });
});

// login form
app.post("/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  
  const user = getUserByEmail(email);

  // checken of user al bestaat
  if (!user) {
    return res.status(400).send("<h3>User not found. <a href='/login.html'>Try again</a></h3>");
  }

  // check password
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).send("<h3>Incorrect password. <a href='/login.html'>Try again</a></h3>");
  }

  // save user in session
  req.session.user = user;
  res.redirect("/profile");
});

// register page
app.get("/register", (req, res) => {
  if (req.session.user) {
    return res.redirect("/profile");
  }
  res.render("register", { user: null });
});

// registration form
app.post("/register", async (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;
  const bio = req.body.bio;

  // checken of email al in gebruik is
  const existingUser = getUserByEmail(email);
  if (existingUser) {
    return res.status(400).send("<h3>Email already in use. <a href='/register'>Try again</a></h3>");
  }

  try {
    // user aanmaken
    createUser(name, email, password, bio || "");
    res.redirect("/login");
  } catch (error) {
    console.error(error);
    res.status(500).send("<h3>Registration failed. Please try again later.</h3>");
  }
});

// profile page
app.get("/profile", (req, res) => {
  // check of al ingelogd is
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

// edit profile page
app.get("/edit-profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  res.render("edit-profile", {
    user: req.session.user
  });
});

// handle editing profile
app.post("/edit-profile", upload.single('profilePicture'), (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const name = req.body.name;
  const bio = req.body.bio;
  const userId = req.session.user.id;
  const removeProfilePicture = req.body.removeProfilePicture === 'on';

  // handle profile picture
  let profilePicture = req.session.user.profile_picture;
  
  if (removeProfilePicture) {
    profilePicture = null;
  } else if (req.file) {
    profilePicture = '/uploads/profiles/' + req.file.filename;
  }

  // update in database
  const stmt = db.prepare("UPDATE users SET name = ?, bio = ?, profile_picture = ? WHERE id = ?");
  stmt.run(name, bio, profilePicture, userId);

  // update session
  req.session.user.name = name;
  req.session.user.bio = bio;
  req.session.user.profile_picture = profilePicture;

  res.redirect("/profile");
});

// vriend adden
app.post("/add-friend", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const friendEmail = req.body.friendEmail;
  const result = sendFriendRequest(req.session.user.id, friendEmail);
  const friends = getFriends(req.session.user.id);
  const requests = getPendingRequests(req.session.user.id) || [];
  
  res.render("profile", {
    user: req.session.user,
    friends: friends,
    requests: requests,
    message: result.message
  });
});

// accept friend request
app.post("/accept-request/:id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const id = req.params.id;
  acceptFriendRequest(id);

  res.redirect("/profile");
});

// reject friend request
app.post("/reject-request/:id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const id = req.params.id;
  rejectFriendRequest(id);

  res.redirect("/profile");
});

// remove friend
app.post("/remove-friend/:id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const friendId = parseInt(req.params.id);
  removeFriend(req.session.user.id, friendId);

  res.redirect("/profile");
});

// view all groeps
app.get("/groups", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groups = getUserGroups(req.session.user.id);
  const enrichedGroups = groups.map(group => {
    const membersWithPics = group.members.map(member => {
      const fullMember = db.prepare("SELECT id, name, profile_picture FROM users WHERE id = ?").get(member.id);

      if (!fullMember.profile_picture) {
        fullMember.profile_picture = "/uploads/Placeholder_pfp.png";
      }

      fullMember.role = member.role;

      return fullMember;
    });

    return {
      ...group,
      members: membersWithPics,
    };
  });

  res.render("groups", { user: req.session.user, groups: enrichedGroups, message: null });
});

// create new groep page
app.get("/groups/new", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const friends = getFriends(req.session.user.id);

  res.render("new-group", {
    user: req.session.user,
    message: null,
    friends: friends
  });
});

// create groep
app.post("/groups", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const name = req.body.name;
  const description = req.body.description;
  const members = req.body.members;

  const groupId = createGroup(name, description, req.session.user.id);
  if (members && members.length > 0) {
    const memberIds = Array.isArray(members) ? members : [members];
    memberIds.forEach(friendId => {
      db.prepare("INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, 'member')").run(friendId, groupId);
    });
  }

  res.redirect("/groups");
});

// view specifieke groep
app.get("/groups/:id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);
  
  if (!group) {
    return res.status(404).send("Group not found");
  }

  // check if user is member
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  const members = getGroupMembers(groupId);
  const isAdmin = membership.role === 'admin';
  const trips = getGroupTrips(groupId);

  res.render("view-group", {
    user: req.session.user,
    group: group,
    members: members,
    isAdmin: isAdmin,
    trips: trips,
    message: null
  });
});

// promote member tot admin
app.post("/groups/:id/promote/:userId", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can promote members");
  }

  updateMemberRole(groupId, userId, 'admin');
  res.redirect(`/groups/${groupId}`);
});

// demote admin tot member
app.post("/groups/:id/demote/:userId", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can demote members");
  }

  updateMemberRole(groupId, userId, 'member');
  res.redirect(`/groups/${groupId}`);
});

// remove member
app.post("/groups/:id/remove/:userId", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can remove members");
  }

  removeGroupMember(groupId, userId);
  res.redirect(`/groups/${groupId}`);
});

// view schedule
app.get("/schedule", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const trips = getUserTrips(req.session.user.id);
  
  res.render("schedule", {
    user: req.session.user,
    trips: trips
  });
});

// view specifieke trip
app.get("/trips/:id", (req, res) => {
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

  const activities = getTripActivities(tripId);
  const group = getGroupById(trip.group_id);
  const isAdmin = membership.role === 'admin';
  const suggestions = getTripSuggestions(tripId);
  const groupMembers = getGroupMembers(trip.group_id);
  const totalMembers = groupMembers.length;
  const votesNeeded = Math.ceil(totalMembers / 2);

  activities.forEach(activity => {
    activity.attachments = getActivityAttachments(activity.id);
  });

  suggestions.forEach(suggestion => {
    const votes = getSuggestionVotes(suggestion.id);
    suggestion.yesVotes = votes.filter(v => v.vote === 'yes').length;
    suggestion.noVotes = votes.filter(v => v.vote === 'no').length;
    suggestion.totalVotes = votes.length;
    suggestion.votesNeeded = votesNeeded;
    
    const userVote = getUserVote(suggestion.id, req.session.user.id);
    suggestion.userVote = userVote ? userVote.vote : null;
  });

  const activitiesByDate = {};
  activities.forEach(activity => {
    if (!activitiesByDate[activity.date]) {
      activitiesByDate[activity.date] = [];
    }
    activitiesByDate[activity.date].push(activity);
  });

  res.render("trip-schedule", {
    user: req.session.user,
    trip: trip,
    group: group,
    activities: activities,
    activitiesByDate: activitiesByDate,
    isAdmin: isAdmin,
    suggestions: suggestions,
    totalMembers: totalMembers,
    votesNeeded: votesNeeded,
    message: null
  });
});

app.post("/trips/:id/activities", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const tripId = parseInt(req.params.id);
  const title = req.body.title;
  const description = req.body.description;
  const location = req.body.location;
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;
  const date = req.body.date;
  const startTime = req.body.startTime;
  const endTime = req.body.endTime;

  const trip = getTripById(tripId);
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  if (!startTime || !endTime) {
    return res.status(400).send("Start and end times are required");
  }

  if (startTime >= endTime) {
    return res.status(400).send("End time must be after start time");
  }

  const overlapCheck = checkActivityOverlap(tripId, date, startTime, endTime);
  if (overlapCheck.hasOverlap) {
    const conflict = overlapCheck.conflictingActivity;
    
    const suggestions = getTripSuggestions(tripId);
    const activities = getTripActivities(tripId);
    const group = getGroupById(trip.group_id);
    const isAdmin = membership.role === 'admin';
    const groupMembers = getGroupMembers(trip.group_id);
    const totalMembers = groupMembers.length;
    const votesNeeded = Math.ceil(totalMembers / 2);

    suggestions.forEach(suggestion => {
      const votes = getSuggestionVotes(suggestion.id);
      suggestion.yesVotes = votes.filter(v => v.vote === 'yes').length;
      suggestion.noVotes = votes.filter(v => v.vote === 'no').length;
      suggestion.totalVotes = votes.length;
      suggestion.votesNeeded = votesNeeded;
      const userVote = getUserVote(suggestion.id, req.session.user.id);
      suggestion.userVote = userVote ? userVote.vote : null;
    });

    const activitiesByDate = {};
    activities.forEach(activity => {
      if (!activitiesByDate[activity.date]) {
        activitiesByDate[activity.date] = [];
      }
      activitiesByDate[activity.date].push(activity);
    });

    return res.render("trip-schedule", {
      user: req.session.user,
      trip: trip,
      group: group,
      activities: activities,
      activitiesByDate: activitiesByDate,
      isAdmin: isAdmin,
      suggestions: suggestions,
      totalMembers: totalMembers,
      votesNeeded: votesNeeded,
      message: `Time conflict! This overlaps with "${conflict.title}" (${conflict.start_time} - ${conflict.end_time})`
    });
  }

  createActivitySuggestion(
    tripId, 
    title, 
    description, 
    location, 
    latitude || null, 
    longitude || null, 
    date, 
    startTime, 
    endTime, 
    req.session.user.id
  );
  
  res.redirect(`/trips/${tripId}`);
});

app.post("/suggestions/:id/vote", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const suggestionId = parseInt(req.params.id);
  const vote = req.body.vote; // 'yes' or 'no'

  const suggestion = db.prepare("SELECT * FROM activity_suggestions WHERE id = ?").get(suggestionId);
  if (!suggestion) {
    return res.status(404).send("Suggestion not found");
  }

  const trip = getTripById(suggestion.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  castVote(suggestionId, req.session.user.id, vote);

  const votes = getSuggestionVotes(suggestionId);
  const yesVotes = votes.filter(v => v.vote === 'yes').length;
  const groupMembers = getGroupMembers(trip.group_id);
  const votesNeeded = Math.ceil(groupMembers.length / 2);

  if (yesVotes >= votesNeeded) {
    approveSuggestion(suggestionId);
  }

  res.redirect(`/trips/${suggestion.trip_id}`);
});

app.post("/suggestions/:id/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const suggestionId = parseInt(req.params.id);
  const suggestion = db.prepare("SELECT * FROM activity_suggestions WHERE id = ?").get(suggestionId);
  
  if (!suggestion) {
    return res.status(404).send("Suggestion not found");
  }

  const trip = getTripById(suggestion.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);

  if (!membership || (membership.role !== 'admin' && suggestion.suggested_by !== req.session.user.id)) {
    return res.status(403).send("You don't have permission to delete this suggestion");
  }

  deleteSuggestion(suggestionId);
  res.redirect(`/trips/${suggestion.trip_id}`);
});

app.get("/groups/:id/trips/new", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);
  
  if (!group) {
    return res.status(404).send("Group not found");
  }

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  res.render("new-trip", {
    user: req.session.user,
    group: group
  });
});

app.post("/groups/:id/trips", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const name = req.body.name;
  const destination = req.body.destination;
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can create trips");
  }

  const tripId = createTrip(groupId, name, destination, startDate, endDate);
  res.redirect(`/trips/${tripId}`);
});

app.post("/activities/:id/delete", (req, res) => {
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
  
  if (!membership || (membership.role !== 'admin' && activity.created_by !== req.session.user.id)) {
    return res.status(403).send("You don't have permission to delete this activity");
  }

  deleteActivity(activityId);
  res.redirect(`/trips/${activity.trip_id}`);
});

// delete groep
app.post("/groups/:id/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);
  
  if (!group) {
    return res.status(404).send("Group not found");
  }

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can delete groups");
  }

  deleteGroup(groupId);
  
  res.redirect("/groups");
});

// delete trip
app.post("/trips/:id/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const tripId = parseInt(req.params.id);
  const trip = getTripById(tripId);
  
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can delete trips");
  }

  const groupId = trip.group_id;
  
  deleteTrip(tripId);
  
  res.redirect(`/groups/${groupId}`);
});

// Add member to group
app.post("/groups/:id/add-member", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const memberEmail = req.body.memberEmail;
  
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can add members");
  }

  const newMember = getUserByEmail(memberEmail);
  if (!newMember) {
    return res.redirect(`/groups/${groupId}?error=User not found`);
  }

  const existingMembership = isGroupMember(newMember.id, groupId);
  if (existingMembership) {
    return res.redirect(`/groups/${groupId}?error=User is already a member`);
  }
  addGroupMember(groupId, newMember.id, 'member');
  
  res.redirect(`/groups/${groupId}?success=Member added successfully`);
});

// Edit groep page
app.get("/groups/:id/edit", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);
  
  if (!group) {
    return res.status(404).send("Group not found");
  }

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can edit group details");
  }

  res.render("edit-group", {
    user: req.session.user,
    group: group
  });
});

// Update groep
app.post("/groups/:id/edit", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const groupId = parseInt(req.params.id);
  const name = req.body.name;
  const description = req.body.description;

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can edit group details");
  }

  updateGroup(groupId, name, description);
  
  res.redirect(`/groups/${groupId}?success=Group details updated successfully`);
});

// Upload attachment to activity
app.post("/activities/:id/attachments", uploadAttachment.single('attachment'), (req, res) => {
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
app.get("/attachments/:id/view", (req, res) => {
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

  // Set appropriate content type
  res.setHeader('Content-Type', attachment.file_type);
  res.setHeader('Content-Disposition', 'inline; filename="' + attachment.original_filename + '"');
  res.sendFile(path.join(__dirname, 'public', attachment.file_path));
});

// Download attachment
app.get("/attachments/:id/download", (req, res) => {
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

  res.download(path.join(__dirname, 'public', attachment.file_path), attachment.original_filename);
});

// Delete attachment
app.post("/attachments/:id/delete", (req, res) => {
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
  
  // Only the uploader or an admin can delete
  if (!membership || (membership.role !== 'admin' && attachment.uploaded_by !== req.session.user.id)) {
    return res.status(403).send("You don't have permission to delete this attachment");
  }

  // Delete file from filesystem
  const fs = require('fs');
  const filePath = path.join(__dirname, 'public', attachment.file_path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  deleteAttachment(attachmentId);
  res.redirect(`/trips/${trip.id}?success=Attachment deleted successfully`);
});

// logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// 404 handler
app.use((request, response, next) => {
  response.status(404).render("404", { 
    user: request.session.user || null 
  });
});

// error handler
app.use((error, request, response, next) => {
  console.error(error.stack);
  response.status(500).render("500", { 
    user: request.session.user || null 
  });
});

// start server
InitializeDatabase();
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});