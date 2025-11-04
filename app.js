import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import db, { InitializeDatabase, getUserByEmail, createUser, getFriends,   sendFriendRequest,
  getPendingRequests, acceptFriendRequest, rejectFriendRequest, removeFriend, createGroup, getUserGroups
, getGroupById, getGroupMembers, isGroupMember, updateMemberRole, removeGroupMember } from "./db.js";

const app = express();
const port = process.env.PORT || 8080; // Set by Docker Entrypoint or use 8080

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

  res.render("view-group", {
    user: req.session.user,
    group,
    members,
    isAdmin,
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