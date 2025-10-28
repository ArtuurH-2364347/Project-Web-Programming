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
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      bio TEXT
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
