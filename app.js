import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import PDFDocument from "pdfkit";

import db, {
  InitializeDatabase,
  getUserByEmail,
  createUser,
  getFriends,
  sendFriendRequest,
  getPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  createGroup,
  getUserGroups,
  getGroupById,
  getGroupMembers,
  isGroupMember,
  updateMemberRole,
  removeGroupMember,
  createTrip,
  createActivity,
  getGroupTrips,
  getTripById,
  getTripActivities,
  deleteActivity,
  getUserTrips,
  getAllUsers,
  promoteUserToAdmin,
  demoteUserToUser,
  deleteUserHard
} from "./db.js";

const app = express();
const port = process.env.PORT || 8080;

// --------------------------------------------------
// SESSION + GLOBAL MIDDLEWARE
// --------------------------------------------------

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "some-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(express.static("public"));

app.use((request, response, next) => {
  console.log(
    `Request URL: ${request.url} @ ${new Date().toLocaleString("nl-BE")}`
  );
  next();
});

// --------------------------------------------------
// ADMIN MIDDLEWARE
// --------------------------------------------------

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("You are not an admin.");
  }
  next();
}

// --------------------------------------------------
// ADMIN ROUTES
// --------------------------------------------------

app.get("/admin/users", requireAdmin, (req, res) => {
  const users = getAllUsers();
  res.render("adminUsers", { user: req.session.user, users });
});

app.post("/admin/promote/:id", requireAdmin, (req, res) => {
  promoteUserToAdmin(req.params.id);
  res.redirect("/admin/users");
});

app.post("/admin/demote/:id", requireAdmin, (req, res) => {
  demoteUserToUser(req.params.id);
  res.redirect("/admin/users");
});

app.post("/admin/delete/:id", requireAdmin, (req, res) => {
  if (req.params.id == req.session.user.id) {
    return res.send("Admins cannot delete themselves.");
  }
  deleteUserHard(req.params.id);
  res.redirect("/admin/users");
});

// --------------------------------------------------
// AUTHENTICATION ROUTES
// --------------------------------------------------

app.get("/", (req, res) => {
  res.render("index", { user: req.session.user });
});

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/profile");
  res.render("login", { user: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = getUserByEmail(email);

  if (!user) {
    return res.status(400).send("<h3>User not found.</h3>");
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).send("<h3>Incorrect password.</h3>");
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    role: user.role
  };

  res.redirect("/profile");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/profile");
  res.render("register", { user: null });
});

app.post("/register", async (req, res) => {
  const { name, email, password, bio } = req.body;

  const existingUser = getUserByEmail(email);
  if (existingUser) {
    return res.status(400).send("Email already in use.");
  }

  createUser(name, email, password, bio || "");
  res.redirect("/login");
});

// --------------------------------------------------
// PROFILE
// --------------------------------------------------

app.get("/profile", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const friends = getFriends(req.session.user.id);
  const requests = getPendingRequests(req.session.user.id);

  res.render("profile", {
    user: req.session.user,
    friends,
    requests,
    message: null
  });
});

app.get("/edit-profile", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  res.render("edit-profile", {
    name: req.session.user.name,
    bio: req.session.user.bio
  });
});

app.post("/edit-profile", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { name, bio } = req.body;
  const userId = req.session.user.id;

  db.prepare("UPDATE users SET name = ?, bio = ? WHERE id = ?")
    .run(name, bio, userId);

  req.session.user.name = name;
  req.session.user.bio = bio;

  res.redirect("/profile");
});

// --------------------------------------------------
// FRIEND SYSTEM
// --------------------------------------------------

app.post("/add-friend", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { friendEmail } = req.body;
  const result = sendFriendRequest(req.session.user.id, friendEmail);

  const friends = getFriends(req.session.user.id);
  const requests = getPendingRequests(req.session.user.id);

  res.render("profile", {
    user: req.session.user,
    friends,
    requests,
    message: result.message
  });
});

app.post("/accept-request/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  acceptFriendRequest(req.params.id);
  res.redirect("/profile");
});

app.post("/reject-request/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  rejectFriendRequest(req.params.id);
  res.redirect("/profile");
});

app.post("/remove-friend/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  removeFriend(req.session.user.id, parseInt(req.params.id));
  res.redirect("/profile");
});

// --------------------------------------------------
// GROUPS
// --------------------------------------------------

app.get("/groups", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groups = getUserGroups(req.session.user.id);
  res.render("groups", { user: req.session.user, groups });
});

app.get("/groups/new", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const friends = getFriends(req.session.user.id);
  res.render("new-group", { user: req.session.user, friends });
});

app.post("/groups", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { name, description, members } = req.body;

  const groupId = createGroup(name, description, req.session.user.id);

  if (members) {
    const arr = Array.isArray(members) ? members : [members];
    arr.forEach(friendId => {
      db.prepare("INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, 'member')")
        .run(friendId, groupId);
    });
  }

  res.redirect("/groups");
});

app.get("/groups/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);

  if (!group) return res.status(404).send("Group not found");

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership) return res.status(403).send("Not a member");

  const members = getGroupMembers(groupId);
  const isAdmin = membership.role === "admin";
  const trips = getGroupTrips(groupId);

  res.render("view-group", {
    user: req.session.user,
    group,
    members,
    isAdmin,
    trips
  });
});

// Promote, demote, remove from group
app.post("/groups/:id/promote/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const membership = isGroupMember(req.session.user.id, groupId);

  if (!membership || membership.role !== "admin")
    return res.status(403).send("Only admins may promote");

  updateMemberRole(groupId, parseInt(req.params.userId), "admin");
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/demote/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const membership = isGroupMember(req.session.user.id, groupId);

  if (!membership || membership.role !== "admin")
    return res.status(403).send("Only admins may demote");

  updateMemberRole(groupId, parseInt(req.params.userId), "member");
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/remove/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const membership = isGroupMember(req.session.user.id, groupId);

  if (!membership || membership.role !== "admin")
    return res.status(403).send("Only admins may remove");

  removeGroupMember(groupId, parseInt(req.params.userId));
  res.redirect(`/groups/${groupId}`);
});

// --------------------------------------------------
// TRIPS
// --------------------------------------------------

app.get("/schedule", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const trips = getUserTrips(req.session.user.id);
  res.render("schedule", { user: req.session.user, trips });
});

app.get("/groups/:id/trips/new", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership) return res.status(403).send("Not a member");

  res.render("new-trip", { user: req.session.user, group });
});

app.post("/groups/:id/trips", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const { name, destination, startDate, endDate } = req.body;

  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== "admin")
    return res.status(403).send("Only admins can create trips");

  const tripId = createTrip(groupId, name, destination, startDate, endDate);
  res.redirect(`/trips/${tripId}`);
});

app.get("/trips/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const tripId = parseInt(req.params.id);
  const trip = getTripById(tripId);

  if (!trip) return res.status(404).send("Trip not found");

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership) return res.status(403).send("Not a member");

  const activities = getTripActivities(tripId);
  const group = getGroupById(trip.group_id);

  const activitiesByDate = {};
  activities.forEach(a => {
    if (!activitiesByDate[a.date]) activitiesByDate[a.date] = [];
    activitiesByDate[a.date].push(a);
  });

  res.render("trip-schedule", {
    user: req.session.user,
    trip,
    group,
    activities,
    activitiesByDate,
    isAdmin: membership.role === "admin"
  });
});

// Add activity
app.post("/trips/:id/activities", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const tripId = parseInt(req.params.id);
  const trip = getTripById(tripId);

  if (!trip) return res.status(404).send("Trip not found");

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership) return res.status(403).send("Not a member");

  const { title, description, location, date, time } = req.body;

  createActivity(tripId, title, description, location, date, time, req.session.user.id);
  res.redirect(`/trips/${tripId}`);
});

// Delete activity
app.post("/activities/:id/delete", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const activityId = parseInt(req.params.id);
  const activity = db.prepare("SELECT * FROM activities WHERE id = ?").get(activityId);

  if (!activity) return res.status(404).send("Activity not found");

  const trip = getTripById(activity.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);

  if (!membership || (membership.role !== "admin" && activity.created_by !== req.session.user.id)) {
    return res.status(403).send("Not allowed");
  }

  deleteActivity(activityId);
  res.redirect(`/trips/${activity.trip_id}`);
});

// --------------------------------------------------
// PDF DOWNLOAD
// --------------------------------------------------

app.get("/trips/:id/pdf", (req, res, next) => {
  if (!req.session.user) return res.redirect("/login");

  try {
    const tripId = parseInt(req.params.id);
    const trip = getTripById(tripId);

    if (!trip) return res.status(404).send("Trip not found");

    const membership = isGroupMember(req.session.user.id, trip.group_id);
    if (!membership) return res.status(403).send("Not a member");

    const activities = getTripActivities(tripId);
    const group = getGroupById(trip.group_id);

    const doc = new PDFDocument({ size: "A4", margin: 50 });

    const safeFileName = trip.name.replace(/[^a-z0-9_\-\. ]/gi, "_");
    res.setHeader("Content-disposition", `attachment; filename="${safeFileName}.pdf"`);
    res.setHeader("Content-type", "application/pdf");

    doc.pipe(res);

    doc.fontSize(20).text(trip.name);
    doc.fontSize(12).text(`${group.name} — ${trip.destination}`);
    doc.moveDown();

    activities.forEach(a => {
      doc.fontSize(14).text(a.date, { underline: true });
      doc.fontSize(12).text(a.title);
      if (a.location) {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.location)}`;
        doc.fillColor("blue").text("View on Google Maps", { link: url, underline: true });
        doc.fillColor("black");
      }
      doc.moveDown();
    });

    doc.end();
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// STATIC TOUR PAGE
// --------------------------------------------------

app.get("/tour", (req, res) => {
  res.render("reispagina", {
    user: req.session.user,
    tourTitle: "Today's Adventure",
    images: ["/images/placeholder.png", "/images/placeholder.png"],
    stops: [
      { name: "Eiffel Tower", description: "Morning visit" },
      { name: "Louvre Museum", description: "Art tour" },
      { name: "Seine River Cruise", description: "Evening boat ride" }
    ]
  });
});

// --------------------------------------------------
// ERROR HANDLERS
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).send("Sorry, can't find that!");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// --------------------------------------------------
// START APP
// --------------------------------------------------

InitializeDatabase();
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
