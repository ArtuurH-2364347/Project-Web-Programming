import Database from "better-sqlite3";
import bcrypt from "bcrypt";

const db = new Database("database.db", { verbose: console.log });

export function InitializeDatabase() {
  db.pragma("journal_mode = WAL;");
  db.pragma("busy_timeout = 5000;");
  db.pragma("synchronous = NORMAL;");
  db.pragma("cache_size = 1000000000;");
  db.pragma("foreign_keys = true;");
  db.pragma("temp_store = memory;");

  // tabel maken als die nog niet bestaat
  // gebruikers table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      bio TEXT
    )
  `).run();

  //friends table
  db.prepare(`
  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(friend_id) REFERENCES users(id),
    UNIQUE(user_id, friend_id)
  )
`).run();

  // voorbeeldaccounts toevoegen
  const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (count === 0) {
    console.log("Seeding example users...");

    const insertUser = db.prepare("INSERT INTO users (name, email, passwordHash, bio) VALUES (?, ?, ?, ?)");
    const exampleUsers = [
      {
        name: "Peter",
        email: "peter@example.com",
        password: "password123",
        bio: "Explorer of hidden gems."
      },
      {
        name: "Jori",
        email: "jori@example.com",
        password: "password123",
        bio: "Adventure seeker and food lover."
      }
    ];

    for (const user of exampleUsers) {
      const passwordHash = bcrypt.hashSync(user.password, 10);
      insertUser.run(user.name, user.email, passwordHash, user.bio);
    }

    console.log("Example users created.");
  }
}

// gebruikers fetchen op basis van email
export function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

// nieuw account aanmaken
export function createUser(name, email, password, bio) {
  const passwordHash = bcrypt.hashSync(password, 10);
  const insert = db.prepare("INSERT INTO users (name, email, passwordHash, bio) VALUES (?, ?, ?, ?)");
  insert.run(name, email, passwordHash, bio);
}

//vriend toevoegen
export function addFriend(userId, friendEmail) {
  const friend = db.prepare("SELECT id FROM users WHERE email = ?").get(friendEmail);
  if (!friend) return { success: false, message: "User not found" };

  // Prevent adding yourself
  if (friend.id === userId) return { success: false, message: "You cannot add yourself" };

  // Check if already friends
  const existing = db.prepare("SELECT * FROM friends WHERE user_id = ? AND friend_id = ?").get(userId, friend.id);
  if (existing) return { success: false, message: "Already friends" };

  db.prepare("INSERT INTO friends (user_id, friend_id) VALUES (?, ?)").run(userId, friend.id);
  return { success: true, message: "Friend added!" };
}

//vrienden opvragen
export function getFriends(userId) {
  return db.prepare(`
    SELECT u.name, u.email 
    FROM users u
    JOIN friends f ON u.id = f.friend_id
    WHERE f.user_id = ?
  `).all(userId);
}


export default db;