import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { 
  InitializeDatabase, getUserByEmail, createUser, getFriends, 
  sendFriendRequest, getPendingRequests, acceptFriendRequest, 
  rejectFriendRequest, removeFriend, createGroup, getUserGroups,
  getGroupById, getGroupMembers, isGroupMember, updateMemberRole, removeGroupMember,
  createTrip, getGroupTrips, getTripById, getTripActivities, createActivity, deleteActivity, getUserTrips,
  createActivitySuggestion, getTripSuggestions, getSuggestionVotes, getUserVote, castVote, approveSuggestion, 
  deleteSuggestion, checkActivityOverlap, deleteGroup, deleteTrip
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

// Multer configureren voor pfps
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
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

// Your routes here ...
app.use(
  session({
    secret: "some-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.urlencoded({ extended: true }));

app.get("/", (request, response) => {
  response.render("index", { user: request.session.user });
});

// Serve login page
app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/profile");
  res.render("login", { user: null });
});

// Handle login form
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = getUserByEmail(email);

  if (!user) {
    return res.status(400).send("<h3>User not found. <a href='/login.html'>Try again</a></h3>");
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).send("<h3>Incorrect password. <a href='/login.html'>Try again</a></h3>");
  }

  req.session.user = user;
  res.redirect("/profile");
});

// Serve registratie pagina
app.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/profile");
  res.render("register", { user: null });
});

// Handle registratie form
app.post("/register", async (req, res) => {
  const { name, email, password, bio } = req.body;

  const existingUser = getUserByEmail(email);
  if (existingUser) {
    return res
      .status(400)
      .send("<h3>Email already in use. <a href='/register'>Try again</a></h3>");
  }

  try {
    createUser(name, email, password, bio || "");
    res.redirect("/login");
  } catch (error) {
    console.error(error);
    res.status(500).send("<h3>Registration failed. Please try again later.</h3>");
  }
});

// Profile route
app.get("/profile", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const friends = getFriends(req.session.user.id);
  const requests = getPendingRequests(req.session.user.id)

  res.render("profile", {
    user: req.session.user,
    name: req.session.user.name,
    email: req.session.user.email,
    bio: req.session.user.bio,
    friends,
    requests,
    message: null
  });
});

// Edit profile page 
app.get("/edit-profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  res.render("edit-profile", {
    user: req.session.user
  });
});

// Handle edit profile form
app.post("/edit-profile", upload.single('profilePicture'), (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const { name, bio } = req.body;
  const userId = req.session.user.id;

  let profilePicture = req.session.user.profile_picture;
  if (req.file) {
    profilePicture = '/uploads/profiles/' + req.file.filename;
  }

  // Update database
  const stmt = db.prepare("UPDATE users SET name = ?, bio = ?, profile_picture = ? WHERE id = ?");
  stmt.run(name, bio, profilePicture, userId);

  // Update session data
  req.session.user.name = name;
  req.session.user.bio = bio;
  req.session.user.profile_picture = profilePicture;

  res.redirect("/profile");
});


// Handle vriend toevoegen
app.post("/add-friend", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { friendEmail } = req.body;
  const result = sendFriendRequest(req.session.user.id, friendEmail);
  const friends = getFriends(req.session.user.id);
  const requests = getPendingRequests(req.session.user.id) || [];
  
  res.render("profile", {
    user: req.session.user,
    friends,
    requests,
    message: result.message
  });
});

app.post("/accept-request/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { id } = req.params;
  acceptFriendRequest(id);

  res.redirect("/profile");
});

app.post("/reject-request/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { id } = req.params;
  rejectFriendRequest(id);

  res.redirect("/profile");
});

app.post("/remove-friend/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const friendId = parseInt(req.params.id);
  removeFriend(req.session.user.id, friendId);

  res.redirect("/profile");
});

// Groups overview
app.get("/groups", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groups = getUserGroups(req.session.user.id);

  const enrichedGroups = groups.map(group => {
    const membersWithPics = group.members.map(member => {
      const fullMember = db.prepare(
        "SELECT id, name, profile_picture FROM users WHERE id = ?"
      ).get(member.id);

      if (!fullMember.profile_picture) {
        fullMember.profile_picture = "/uploads/Placeholder_pfp.png";
      }

      // Keep the role from the original member
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


// Show create-group form
app.get("/groups/new", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const friends = getFriends(req.session.user.id);

  res.render("new-group", {
    user: req.session.user,
    message: null,
    friends
  });
});

//create group form
app.post("/groups", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { name, description, members } = req.body;

  // groep aanmaken
  const groupId = createGroup(name, description, req.session.user.id);

  // members kunnen undefined zijn als er geen zijn geselecteerd
  if (members && members.length > 0) {
    // members moet altijd een array zijn
    const memberIds = Array.isArray(members) ? members : [members];
    memberIds.forEach(friendId => {
      db.prepare("INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, 'member')").run(friendId, groupId);
    });
  }

  res.redirect("/groups");
});

// bekijk specifieke groep
app.get("/groups/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);
  
  if (!group) {
    return res.status(404).send("Group not found");
  }

  // check of user een member is
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  const members = getGroupMembers(groupId);
  const isAdmin = membership.role === 'admin';
    const trips = getGroupTrips(groupId);

  res.render("view-group", {
    user: req.session.user,
    group,
    members,
    isAdmin,
    trips,
    message: null
  });
});

// Promote member tot admin
app.post("/groups/:id/promote/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  // Check of member een admin is
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can promote members");
  }

  updateMemberRole(groupId, userId, 'admin');
  res.redirect(`/groups/${groupId}`);
});

// Demote admin tot member
app.post("/groups/:id/demote/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  // Check of member een admin is
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can demote members");
  }

  updateMemberRole(groupId, userId, 'member');
  res.redirect(`/groups/${groupId}`);
});

// member uit groep smijten
app.post("/groups/:id/remove/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  // Check of user een member is
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can remove members");
  }

  removeGroupMember(groupId, userId);
  res.redirect(`/groups/${groupId}`);
});

// Schedule overview
app.get("/schedule", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const trips = getUserTrips(req.session.user.id);
  
  res.render("schedule", {
    user: req.session.user,
    trips
  });
});

// View specific trip schedule
app.get("/trips/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const tripId = parseInt(req.params.id);
  const trip = getTripById(tripId);
  
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  // Check if user is member of the group
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

  // Add vote counts and user's vote to each suggestion
  suggestions.forEach(suggestion => {
    const votes = getSuggestionVotes(suggestion.id);
    suggestion.yesVotes = votes.filter(v => v.vote === 'yes').length;
    suggestion.noVotes = votes.filter(v => v.vote === 'no').length;
    suggestion.totalVotes = votes.length;
    suggestion.votesNeeded = votesNeeded;
    
    const userVote = getUserVote(suggestion.id, req.session.user.id);
    suggestion.userVote = userVote ? userVote.vote : null;
  });

  // Group activities by date
  const activitiesByDate = {};
  activities.forEach(activity => {
    if (!activitiesByDate[activity.date]) {
      activitiesByDate[activity.date] = [];
    }
    activitiesByDate[activity.date].push(activity);
  });

  res.render("trip-schedule", {
    user: req.session.user,
    trip,
    group,
    activities,
    activitiesByDate,
    isAdmin,
    suggestions,
    totalMembers,
    votesNeeded,
    message: null
  });
});

// suggestions aanmaken met validatie
app.post("/trips/:id/activities", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const tripId = parseInt(req.params.id);
  const { title, description, location, latitude, longitude, date, startTime, endTime } = req.body;  // Add latitude and longitude here

  const trip = getTripById(tripId);
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  // input valideren
  if (!startTime || !endTime) {
    return res.status(400).send("Start and end times are required");
  }

  if (startTime >= endTime) {
    return res.status(400).send("End time must be after start time");
  }

  // overlaps checken
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
      trip,
      group,
      activities,
      activitiesByDate,
      isAdmin,
      suggestions,
      totalMembers,
      votesNeeded,
      message: `Time conflict! This overlaps with "${conflict.title}" (${conflict.start_time} - ${conflict.end_time})`
    });
  }

  // suggestion maken - ADD LATITUDE AND LONGITUDE HERE
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

// stemmen op suggestion
app.post("/suggestions/:id/vote", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const suggestionId = parseInt(req.params.id);
  const { vote } = req.body; // 'yes' of 'no'

  const suggestion = db.prepare("SELECT * FROM activity_suggestions WHERE id = ?").get(suggestionId);
  if (!suggestion) {
    return res.status(404).send("Suggestion not found");
  }

  const trip = getTripById(suggestion.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  // Cast the vote
  castVote(suggestionId, req.session.user.id, vote);

  // Checken of we genoeg stemmen hebben
  const votes = getSuggestionVotes(suggestionId);
  const yesVotes = votes.filter(v => v.vote === 'yes').length;
  const groupMembers = getGroupMembers(trip.group_id);
  const votesNeeded = Math.ceil(groupMembers.length / 2);

  if (yesVotes >= votesNeeded) {
    // goedkeuren en toevoegen aan activiteiten
    approveSuggestion(suggestionId);
  }

  res.redirect(`/trips/${suggestion.trip_id}`);
});

// Delete activity suggestion
app.post("/suggestions/:id/delete", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const suggestionId = parseInt(req.params.id);
  const suggestion = db.prepare("SELECT * FROM activity_suggestions WHERE id = ?").get(suggestionId);
  
  if (!suggestion) {
    return res.status(404).send("Suggestion not found");
  }

  const trip = getTripById(suggestion.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);

  // Only admins or the suggester can delete
  if (!membership || (membership.role !== 'admin' && suggestion.suggested_by !== req.session.user.id)) {
    return res.status(403).send("You don't have permission to delete this suggestion");
  }

  deleteSuggestion(suggestionId);
  res.redirect(`/trips/${suggestion.trip_id}`);
});

// Show form to create new trip
app.get("/groups/:id/trips/new", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

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
    group
  });
});

// Handle creating new trip
app.post("/groups/:id/trips", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const { name, destination, startDate, endDate } = req.body;

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can create trips");
  }

  const tripId = createTrip(groupId, name, destination, startDate, endDate);
  res.redirect(`/trips/${tripId}`);
});

// Delete activity
app.post("/activities/:id/delete", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

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

// Delete group (admins only)
app.post("/groups/:id/delete", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

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

// Delete trip (admins only)
app.post("/trips/:id/delete", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

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

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});


// Middleware for unknown routes
// Must be last in pipeline
app.use((request, response, next) => {
  response.status(404).send("Sorry can't find that!");
});

// Middleware for error handling
app.use((error, request, response, next) => {
  console.error(error.stack);
  response.status(500).send("Something broke!");
});

// App starts here
InitializeDatabase();
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});