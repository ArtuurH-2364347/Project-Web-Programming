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

  // Symmetrische friends table
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

  // Friend requests table
  db.prepare(`
  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('pending','accepted','rejected')) DEFAULT 'pending',
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id),
    UNIQUE(sender_id, receiver_id)
    )
  `).run();

  db.prepare(`
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  )
`).run();

  db.prepare(`
  CREATE TABLE IF NOT EXISTS group_members (
    user_id INTEGER,
    group_id INTEGER,
    PRIMARY KEY(user_id, group_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(group_id) REFERENCES groups(id)
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
export function addFriend(userId, friendIdentifier) {
  let friendId;

  if (typeof friendIdentifier === "string") {
    // als het een email is
    const friend = db.prepare("SELECT id FROM users WHERE email = ?").get(friendIdentifier);
    if (!friend) return { success: false, message: "User not found" };
    friendId = friend.id;
  } else {
    // als het een id is
    friendId = friendIdentifier;
  }

  // je mag jezelf niet toevoegen
  if (friendId === userId) return { success: false, message: "You cannot add yourself" };

  // als al vrienden zijn
  const existing = db.prepare("SELECT * FROM friends WHERE user_id = ? AND friend_id = ?").get(userId, friendId);
  if (existing) return { success: false, message: "Already friends" };

  // in beide richtingen toevoegen
  db.prepare("INSERT INTO friends (user_id, friend_id) VALUES (?, ?)").run(userId, friendId);
  db.prepare("INSERT INTO friends (user_id, friend_id) VALUES (?, ?)").run(friendId, userId);

  return { success: true, message: "Friend added!" };
}

// friend request sturen
export function sendFriendRequest(senderId, receiverEmail) {
  const receiver = db.prepare("SELECT id FROM users WHERE email = ?").get(receiverEmail);
  if (!receiver) return { success: false, message: "User not found." };
  if (receiver.id === senderId) return { success: false, message: "You cannot add yourself." };

  // checken of al vrienden zijn
  const alreadyFriends = db.prepare(`
    SELECT 1 FROM friends 
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
  `).get(senderId, receiver.id, receiver.id, senderId);
  if (alreadyFriends) return { success: false, message: "You are already friends." };

  // Checken of er al een request is
  const existingRequest = db.prepare(`
    SELECT * FROM friend_requests 
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
  `).get(senderId, receiver.id, receiver.id, senderId);
  if (existingRequest) return { success: false, message: "Friend request already exists." };

  db.prepare(`
    INSERT INTO friend_requests (sender_id, receiver_id, status)
    VALUES (?, ?, 'pending')
  `).run(senderId, receiver.id);

  return { success: true, message: "Friend request sent!" };
}

// onbeantwoorde requests opvragen
export function getPendingRequests(userId) {
  return db.prepare(`
    SELECT fr.id, u.name, u.email
    FROM friend_requests fr
    JOIN users u ON u.id = fr.sender_id
    WHERE fr.receiver_id = ? AND fr.status = 'pending'
  `).all(userId);
}

export function acceptFriendRequest(id) {
  const request = db.prepare("SELECT * FROM friend_requests WHERE id = ?").get(id);
  if (!request) return { success: false, message: "Request not found" };

  addFriend(request.sender_id, request.receiver_id);
  addFriend(request.receiver_id, request.sender_id);

  //request deleten nu die behandeld is
  db.prepare("DELETE FROM friend_requests WHERE id = ?").run(id);

  return { success: true, message: "Friend request accepted" };
}


export function rejectFriendRequest(id) {
  const request = db.prepare("SELECT * FROM friend_requests WHERE id = ?").get(id);
  if (!request) return { success: false, message: "Request not found" };

  //request deleten nu die behandeld is
  db.prepare("DELETE FROM friend_requests WHERE id = ?").run(id);

  return { success: true, message: "Friend request rejected" };
}

//vrienden opvragen
export function getFriends(userId) {
  return db.prepare(`
    SELECT u.id, u.name, u.email 
    FROM users u
    JOIN friends f ON u.id = f.friend_id
    WHERE f.user_id = ?
  `).all(userId);
}

// vriend verwijderen (symmetrical remove)
export function removeFriend(userId, friendId) {
  db.prepare("DELETE FROM friends WHERE user_id = ? AND friend_id = ?").run(userId, friendId);
  db.prepare("DELETE FROM friends WHERE user_id = ? AND friend_id = ?").run(friendId, userId);
  return { success: true, message: "Friend removed successfully." };
}

export function createGroup(name, description, ownerId) {
  const stmt = db.prepare("INSERT INTO groups (name, description, owner_id) VALUES (?, ?, ?)");
  const result = stmt.run(name, description, ownerId);

  // Automatically add the owner as a member
  db.prepare("INSERT INTO group_members (user_id, group_id) VALUES (?, ?)").run(ownerId, result.lastInsertRowid);
  return result.lastInsertRowid;
}


export function getUserGroups(userId) {
  const groups = db.prepare(`
    SELECT g.id, g.name, g.description
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ?
  `).all(userId);

  groups.forEach(group => {
    const members = db.prepare(`
      SELECT u.id, u.name, u.email
      FROM users u
      JOIN group_members gm ON gm.user_id = u.id
      WHERE gm.group_id = ?
    `).all(group.id);
    
    group.members = members;
    group.memberCount = members.length;
  });

  return groups;
}

export default db;