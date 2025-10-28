import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import { InitializeDatabase, getUserByEmail } from "./db.js";

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

app.get("/", (request, response) => {
  response.send("Hello World!");
});

// Your routes here ...
app.use(
  session({
    secret: "some-secret-key", // should be an env variable in production
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.urlencoded({ extended: true }));
// Serve login page
app.get("/login", (req, res) => {
  res.sendFile(process.cwd() + "/public/login.html");
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

// Profile route
app.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  res.render("profile", {
    name: req.session.user.name,
    email: req.session.user.email,
    bio: req.session.user.bio
  });
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login.html"));
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

