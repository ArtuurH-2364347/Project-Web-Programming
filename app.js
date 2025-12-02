import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import PDFDocument from "pdfkit";
import db, { InitializeDatabase, getUserByEmail, createUser, getFriends,   sendFriendRequest,
  getPendingRequests, acceptFriendRequest, rejectFriendRequest, removeFriend, createGroup, getUserGroups
, getGroupById, getGroupMembers, isGroupMember, updateMemberRole, removeGroupMember, createTrip, createActivity
, getGroupTrips, getTripById, getTripActivities, deleteActivity, getUserTrips } from "./db.js";

const app = express();
const port = process.env.PORT || 8080; // Set by Docker Entrypoint or use 8080

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("You are not an admin.");
  }
  next();
}

app.get("/admin/users", requireAdmin, (req, res) => {
  const users = getAllUsers();
  res.render("adminUsers", { users });
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

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    role: user.role
  };

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

// Edit profile page (GET)
app.get("/edit-profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  res.render("edit-profile", {
    name: req.session.user.name,
    bio: req.session.user.bio
  });
});

// Handle edit profile form (POST)
app.post("/edit-profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  const { name, bio } = req.body;
  const userId = req.session.user.id;

  // Update database
  const stmt = db.prepare("UPDATE users SET name = ?, bio = ? WHERE id = ?");
  stmt.run(name, bio, userId);

  // Update session data
  req.session.user.name = name;
  req.session.user.bio = bio;

  res.redirect("/profile");
});


// Handle adding a friend
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
  res.render("groups", { user: req.session.user, groups, message: null });
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

  // Create the group
  const groupId = createGroup(name, description, req.session.user.id);

  // members may be undefined if none selected
  if (members && members.length > 0) {
    // Ensure members is always an array
    const memberIds = Array.isArray(members) ? members : [members];
    memberIds.forEach(friendId => {
      db.prepare("INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, 'member')").run(friendId, groupId);
    });
  }

  res.redirect("/groups");
});

// View individual group
app.get("/groups/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const group = getGroupById(groupId);
  
  if (!group) {
    return res.status(404).send("Group not found");
  }

  // Check if user is a member
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

// Promote member to admin
app.post("/groups/:id/promote/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  // Check if current user is admin
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can promote members");
  }

  updateMemberRole(groupId, userId, 'admin');
  res.redirect(`/groups/${groupId}`);
});

// Demote admin to member
app.post("/groups/:id/demote/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  // Check if current user is admin
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can demote members");
  }

  updateMemberRole(groupId, userId, 'member');
  res.redirect(`/groups/${groupId}`);
});

// Remove member from group
app.post("/groups/:id/remove/:userId", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  // Check if current user is admin
  const membership = isGroupMember(req.session.user.id, groupId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).send("Only admins can remove members");
  }

  removeGroupMember(groupId, userId);
  res.redirect(`/groups/${groupId}`);
});

// Schedule overview - shows all trips user is part of
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
    message: null
  });
});

// Download trip as PDF
app.get("/trips/:id/pdf", (req, res, next) => {
  if (!req.session.user) return res.redirect("/login");

  try {
    const tripId = parseInt(req.params.id);
    const trip = getTripById(tripId);

    if (!trip) return res.status(404).send("Trip not found");

    const membership = isGroupMember(req.session.user.id, trip.group_id);
    if (!membership) return res.status(403).send("You are not a member of this group");

    const activities = getTripActivities(tripId) || [];
    const group = getGroupById(trip.group_id) || { name: "Group" };

    // safe defaults
    const tripName = trip.name || "Trip";
    const destination = trip.destination || "Unknown destination";
    const startDate = trip.start_date ? new Date(trip.start_date).toLocaleDateString() : "Unknown";
    const endDate = trip.end_date ? new Date(trip.end_date).toLocaleDateString() : "Unknown";

    // create document
    const doc = new PDFDocument({
      size: "A4",
      margin: 50
    });

    // response headers
    const safeFileName = tripName.replace(/[^a-z0-9_\-\. ]/gi, "_");
    res.setHeader("Content-disposition", `attachment; filename="${safeFileName}.pdf"`);
    res.setHeader("Content-type", "application/pdf");

    // pipe PDF to response
    doc.pipe(res);

    // HEADER
    // Add a simple colored header rectangle (thin) and title
    doc.fontSize(20).fillColor("#333").text(tripName, { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#666").text(`${group.name} · ${destination}`, { align: "left" });
    doc.moveDown(0.5);

    // horizontal line
    const startX = doc.page.margins.left;
    const endX = doc.page.width - doc.page.margins.right;
    const y = doc.y;
    doc.moveTo(startX, y).lineTo(endX, y).strokeColor("#cccccc").lineWidth(1).stroke();
    doc.moveDown();

    // Trip dates and generated by info
    doc.fontSize(10).fillColor("#000");
    doc.text(`Dates: ${startDate} — ${endDate}`);
    doc.text(`Generated by: ${req.session.user ? req.session.user.name : "Unknown user"}`);
    doc.moveDown(1);

    // Group activities by date (sorted)
    const grouped = {};
    activities.forEach(a => {
      const dateKey = a.date || "Unknown date";
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(a);
    });

    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

    // layout settings
    const bulletIndent = 12;
    const lineGap = 4;

    if (sortedDates.length === 0) {
      doc.fontSize(12).fillColor("#666").text("No activities planned for this trip.", { italics: true });
    } else {
      sortedDates.forEach(date => {
        // print date header
        const prettyDate = (date !== "Unknown date") ? new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : date;
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor("#000").text(prettyDate, { underline: true });
        doc.moveDown(0.2);

        grouped[date].forEach(a => {
          // Activity title
          doc.fontSize(12).fillColor("#222").text(`• ${a.title || "Untitled activity"}`, {
            continued: false,
            indent: 0,
            paragraphGap: lineGap
          });

          // Time / Location / Notes — smaller, indented
          const infoLines = [];
          if (a.time) infoLines.push(`Time: ${a.time}`);
          if (a.location) infoLines.push(`Location: ${a.location}`);
          if (a.description) infoLines.push(`Notes: ${a.description}`);
          if (a.creator_name) infoLines.push(`Added by: ${a.creator_name}`);

          infoLines.forEach((line, idx) => {
            doc.fontSize(10).fillColor("#444").text(`    ${line}`);
          });

          // If there is a location, add a clickable Google Maps link
          if (a.location) {
            try {
              const query = encodeURIComponent(a.location);
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
              // print a blue underlined link
              doc.moveDown(0.1);
              doc.fillColor("blue").fontSize(10).text("View on Google Maps", {
                link: mapsUrl,
                underline: true,
                continued: false,
                indent: 0
              });
              // restore color
              doc.fillColor("#444");
            } catch (err) {
              // if encoding/link fails, ignore silently and continue
            }
          }

          doc.moveDown(0.4);
        });

        doc.moveDown(0.8);
      });
    }

    // FOOTER (simple)
    // Add page footer text on the current page (for multi-page youd normally listen to 'pageAdded')
    const footerText = `TravelBuddy — ${new Date().toLocaleDateString()}`;
    const footerY = doc.page.height - doc.page.margins.bottom + 10;
    doc.fontSize(8).fillColor("#888").text(footerText, doc.page.margins.left, footerY, {
      align: "left"
    });

    // finalize PDF
    doc.end();

  } catch (err) {
    // make sure express logs it
    next(err);
  }
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

// Add activity to trip
app.post("/trips/:id/activities", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const tripId = parseInt(req.params.id);
  const { title, description, location, date, time } = req.body;

  const trip = getTripById(tripId);
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  const membership = isGroupMember(req.session.user.id, trip.group_id);
  if (!membership) {
    return res.status(403).send("You are not a member of this group");
  }

  createActivity(tripId, title, description, location, date, time, req.session.user.id);
  res.redirect(`/trips/${tripId}`);
});

// Delete activity
app.post("/activities/:id/delete", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const activityId = parseInt(req.params.id);
  
  // Get activity to find trip_id for redirect
  const activity = db.prepare("SELECT * FROM activities WHERE id = ?").get(activityId);
  if (!activity) {
    return res.status(404).send("Activity not found");
  }

  const trip = getTripById(activity.trip_id);
  const membership = isGroupMember(req.session.user.id, trip.group_id);
  
  // Only admins or the creator can delete
  if (!membership || (membership.role !== 'admin' && activity.created_by !== req.session.user.id)) {
    return res.status(403).send("You don't have permission to delete this activity");
  }

  deleteActivity(activityId);
  res.redirect(`/trips/${activity.trip_id}`);
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Tour page route
app.get("/tour", (req, res) => {
  res.render("reispagina", {
    user: req.session.user,
    tourTitle: "Today's Adventure",
    images: ["/images/placeholder.png", "/images/placeholder.png"],
    stops: [
      { name: "Eiffel Tower", description: "Morning visit and photoshoot." },
      { name: "Louvre Museum", description: "Art tour in the afternoon." },
      { name: "Seine River Cruise", description: "Evening boat ride." }
    ]
  });
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