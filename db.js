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
      bio TEXT,
      profile_picture TEXT
    )
  `).run();

  addBannerImageColumn()
  
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
      role TEXT CHECK(role IN ('admin','member')) DEFAULT 'member',
      PRIMARY KEY(user_id, group_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(group_id) REFERENCES groups(id)
    )
  `).run();

  // Trips table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      destination TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      FOREIGN KEY(group_id) REFERENCES groups(id)
    )
  `).run();

  // Activities table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      latitude REAL,
      longitude REAL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      created_by INTEGER,
      FOREIGN KEY(trip_id) REFERENCES trips(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    )
  `).run();

  // Suggestions table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS activity_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      latitude REAL,
      longitude REAL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      suggested_by INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(trip_id) REFERENCES trips(id),
      FOREIGN KEY(suggested_by) REFERENCES users(id)
    )
  `).run();

  // Votes table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS activity_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suggestion_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      vote TEXT CHECK(vote IN ('yes','no')) NOT NULL,
      FOREIGN KEY(suggestion_id) REFERENCES activity_suggestions(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(suggestion_id, user_id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS activity_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_by INTEGER NOT NULL,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(activity_id) REFERENCES activities(id),
      FOREIGN KEY(uploaded_by) REFERENCES users(id)
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
        bio: "This can be anything!"
      },
      {
        name: "Jori",
        email: "jori@example.com",
        password: "password123",
        bio: "This can be anything!"
      },
      {
        name: "Artuur",
        email: "artuur.heidbuchel@protonmail.com",
        password: "wachtwoord",
        bio: "Ik heb ook een bio!"
      }
    ];

    for (const user of exampleUsers) {
      const passwordHash = bcrypt.hashSync(user.password, 10);
      insertUser.run(user.name, user.email, passwordHash, user.bio);
    }

    console.log("Example users created.");
  }
}

export function addBannerImageColumn() {
  try {
    db.prepare(`
      ALTER TABLE users ADD COLUMN banner_image TEXT
    `).run();
    console.log("Banner image column added successfully.");
  } catch (error) {
    // Column might already exist
    if (!error.message.includes('duplicate column name')) {
      console.error("Error adding banner_image column:", error);
    }
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

  // Automatically add the owner as an admin member
  db.prepare("INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, 'admin')").run(ownerId, result.lastInsertRowid);
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
      SELECT u.id, u.name, u.email, u.profile_picture, gm.role
      FROM users u
      JOIN group_members gm ON gm.user_id = u.id
      WHERE gm.group_id = ?
    `).all(group.id);
    
    group.members = members;
    group.memberCount = members.length;
  });

  return groups;
}

export function getGroupById(groupId) {
  return db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
}

export function getGroupMembers(groupId) {
  return db.prepare(`
    SELECT u.id, u.name, u.email, u.profile_picture, gm.role
    FROM users u
    JOIN group_members gm ON gm.user_id = u.id
    WHERE gm.group_id = ?
    ORDER BY gm.role DESC, u.name ASC
  `).all(groupId);
}

export function isGroupMember(userId, groupId) {
  return db.prepare(`
    SELECT role FROM group_members 
    WHERE user_id = ? AND group_id = ?
  `).get(userId, groupId);
}

export function updateMemberRole(groupId, userId, newRole) {
  db.prepare(`
    UPDATE group_members 
    SET role = ? 
    WHERE group_id = ? AND user_id = ?
  `).run(newRole, groupId, userId);
}

export function removeGroupMember(groupId, userId) {
  db.prepare(`
    DELETE FROM group_members 
    WHERE group_id = ? AND user_id = ?
  `).run(groupId, userId);
}

// Trip functions
export function createTrip(groupId, name, destination, startDate, endDate) {
  const stmt = db.prepare(`
    INSERT INTO trips (group_id, name, destination, start_date, end_date) 
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(groupId, name, destination, startDate, endDate);
  return result.lastInsertRowid;
}

export function getGroupTrips(groupId) {
  return db.prepare(`
    SELECT * FROM trips 
    WHERE group_id = ? 
    ORDER BY start_date DESC
  `).all(groupId);
}

export function getTripById(tripId) {
  return db.prepare("SELECT * FROM trips WHERE id = ?").get(tripId);
}

export function getTripActivities(tripId) {
  return db.prepare(`
    SELECT a.*, u.name as creator_name
    FROM activities a
    LEFT JOIN users u ON u.id = a.created_by
    WHERE a.trip_id = ?
    ORDER BY a.date ASC, a.start_time ASC
  `).all(tripId);
}

export function createActivity(tripId, title, description, location, latitude, longitude, date, startTime, endTime, createdBy) {
  const stmt = db.prepare(`
    INSERT INTO activities (trip_id, title, description, location, latitude, longitude, date, start_time, end_time, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(tripId, title, description, location, latitude, longitude, date, startTime, endTime, createdBy);
  return result.lastInsertRowid;
}

export function deleteActivity(activityId) {
  db.prepare("DELETE FROM activities WHERE id = ?").run(activityId);
}

export function getUserTrips(userId) {
  return db.prepare(`
    SELECT DISTINCT t.*, g.name as group_name
    FROM trips t
    JOIN groups g ON g.id = t.group_id
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ?
    ORDER BY t.start_date DESC
  `).all(userId);
}

// Activity suggestion functions
export function createActivitySuggestion(tripId, title, description, location, latitude, longitude, date, startTime, endTime, suggestedBy) {
  const stmt = db.prepare(`
    INSERT INTO activity_suggestions (trip_id, title, description, location, latitude, longitude, date, start_time, end_time, suggested_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(tripId, title, description, location, latitude, longitude, date, startTime, endTime, suggestedBy);
  return result.lastInsertRowid;
}

export function getTripSuggestions(tripId) {
  return db.prepare(`
    SELECT s.*, u.name as suggester_name
    FROM activity_suggestions s
    LEFT JOIN users u ON u.id = s.suggested_by
    WHERE s.trip_id = ?
    ORDER BY s.created_at DESC
  `).all(tripId);
}

export function getSuggestionVotes(suggestionId) {
  return db.prepare(`
    SELECT v.*, u.name as voter_name
    FROM activity_votes v
    LEFT JOIN users u ON u.id = v.user_id
    WHERE v.suggestion_id = ?
  `).all(suggestionId);
}

export function getUserVote(suggestionId, userId) {
  return db.prepare(`
    SELECT vote FROM activity_votes
    WHERE suggestion_id = ? AND user_id = ?
  `).get(suggestionId, userId);
}

export function castVote(suggestionId, userId, vote) {
  const stmt = db.prepare(`
    INSERT INTO activity_votes (suggestion_id, user_id, vote)
    VALUES (?, ?, ?)
    ON CONFLICT(suggestion_id, user_id) 
    DO UPDATE SET vote = excluded.vote
  `);
  stmt.run(suggestionId, userId, vote);
}

export function getSuggestionById(suggestionId) {
  return db.prepare("SELECT * FROM activity_suggestions WHERE id = ?").get(suggestionId);
}

export function deleteSuggestion(suggestionId) {
  // eerst stem deleten
  db.prepare("DELETE FROM activity_votes WHERE suggestion_id = ?").run(suggestionId);
  // dan suggestion deleten
  db.prepare("DELETE FROM activity_suggestions WHERE id = ?").run(suggestionId);
}

export function approveSuggestion(suggestionId) {
  const suggestion = getSuggestionById(suggestionId);
  if (!suggestion) return false;

  createActivity(
    suggestion.trip_id,
    suggestion.title,
    suggestion.description,
    suggestion.location,
    suggestion.latitude,
    suggestion.longitude,
    suggestion.date,
    suggestion.start_time,
    suggestion.end_time,
    suggestion.suggested_by
  );
  deleteSuggestion(suggestionId);
  return true;
}

export function checkActivityOverlap(tripId, date, startTime, endTime, excludeActivityId = null) {
  // Alle activiteiten met dezelfde datum nemen
  let query = `
    SELECT * FROM activities 
    WHERE trip_id = ? AND date = ?
  `;
  let params = [tripId, date];
  
  if (excludeActivityId) {
    query += ` AND id != ?`;
    params.push(excludeActivityId);
  }
  
  const activities = db.prepare(query).all(...params);
  
  // overlap checken
  for (const activity of activities) {
    // format omzetten
    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    const existingStart = timeToMinutes(activity.start_time);
    const existingEnd = timeToMinutes(activity.end_time);
    
    // checken voor overlap
    if (newStart < existingEnd && newEnd > existingStart) {
      return {
        hasOverlap: true,
        conflictingActivity: activity
      };
    }
  }
  
  return { hasOverlap: false };
}

// format omzet functie
function timeToMinutes(timeString) {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

export function deleteGroup(groupId) {
  
  db.prepare(`
    DELETE FROM activity_votes 
    WHERE suggestion_id IN (
      SELECT s.id FROM activity_suggestions s
      JOIN trips t ON t.id = s.trip_id
      WHERE t.group_id = ?
    )
  `).run(groupId);
  
  db.prepare(`
    DELETE FROM activity_suggestions 
    WHERE trip_id IN (
      SELECT id FROM trips WHERE group_id = ?
    )
  `).run(groupId);
  
  db.prepare(`
    DELETE FROM activities 
    WHERE trip_id IN (
      SELECT id FROM trips WHERE group_id = ?
    )
  `).run(groupId);
  
  db.prepare("DELETE FROM trips WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM group_members WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
  
  return { success: true, message: "Group deleted successfully" };
}


export function deleteTrip(tripId) {
  db.prepare(`
    DELETE FROM activity_votes 
    WHERE suggestion_id IN (
      SELECT id FROM activity_suggestions WHERE trip_id = ?
    )
  `).run(tripId);
  db.prepare("DELETE FROM activity_suggestions WHERE trip_id = ?").run(tripId);
  db.prepare("DELETE FROM activities WHERE trip_id = ?").run(tripId);
  db.prepare("DELETE FROM trips WHERE id = ?").run(tripId);
  
  return { success: true, message: "Trip deleted successfully" };
}

export function addGroupMember(groupId, userId, role = 'member') {
  const stmt = db.prepare(`
    INSERT INTO group_members (user_id, group_id, role)
    VALUES (?, ?, ?)
  `);
  stmt.run(userId, groupId, role);
  return { success: true, message: "Member added successfully" };
}

export function updateGroup(groupId, name, description) {
  const stmt = db.prepare(`
    UPDATE groups 
    SET name = ?, description = ? 
    WHERE id = ?
  `);
  stmt.run(name, description, groupId);
  return { success: true, message: "Group updated successfully" };
}

export function createAttachment(activityId, filename, originalFilename, filePath, fileType, fileSize, uploadedBy) {
  const stmt = db.prepare(`
    INSERT INTO activity_attachments (activity_id, filename, original_filename, file_path, file_type, file_size, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(activityId, filename, originalFilename, filePath, fileType, fileSize, uploadedBy);
  return result.lastInsertRowid;
}

export function getActivityAttachments(activityId) {
  return db.prepare(`
    SELECT a.*, u.name as uploader_name
    FROM activity_attachments a
    LEFT JOIN users u ON u.id = a.uploaded_by
    WHERE a.activity_id = ?
    ORDER BY a.uploaded_at DESC
  `).all(activityId);
}

export function getAttachmentById(attachmentId) {
  return db.prepare("SELECT * FROM activity_attachments WHERE id = ?").get(attachmentId);
}

export function deleteAttachment(attachmentId) {
  db.prepare("DELETE FROM activity_attachments WHERE id = ?").run(attachmentId);
}

export function searchUsers(searchQuery, currentUserId) {
  const users = db.prepare(`
    SELECT 
      u.id, 
      u.name, 
      u.email, 
      u.bio, 
      u.profile_picture,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM friends 
          WHERE user_id = ? AND friend_id = u.id
        ) THEN 'friends'
        WHEN EXISTS (
          SELECT 1 FROM friend_requests 
          WHERE sender_id = ? AND receiver_id = u.id AND status = 'pending'
        ) THEN 'request_sent'
        WHEN EXISTS (
          SELECT 1 FROM friend_requests 
          WHERE sender_id = u.id AND receiver_id = ? AND status = 'pending'
        ) THEN 'request_received'
        ELSE 'none'
      END as relationship_status
    FROM users u
    WHERE u.id != ?
    AND (u.name LIKE ? OR u.email LIKE ?)
    ORDER BY u.name ASC
    LIMIT 20
  `).all(
    currentUserId, 
    currentUserId, 
    currentUserId, 
    currentUserId, 
    `%${searchQuery}%`, 
    `%${searchQuery}%`
  );
  
  return users;
}

export default db;