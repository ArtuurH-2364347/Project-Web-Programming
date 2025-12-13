import Database from "better-sqlite3";
import bcrypt from "bcrypt";

const db = new Database("database.db", { verbose: console.log });

try {
  db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'").run();
} catch {}

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
    role TEXT DEFAULT 'user',
    banner_image TEXT,
    profile_picture TEXT
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

  // Activities table - WITH latitude and longitude
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

  // Suggestions table - WITH latitude and longitude
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

  // Trip Photos table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS trip_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      caption TEXT,
      uploaded_by INTEGER NOT NULL,
      source TEXT CHECK(source IN ('upload','google_photos')) DEFAULT 'upload',
      google_photo_id TEXT,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY(uploaded_by) REFERENCES users(id)
    )
  `).run();
  // Add this to your InitializeDatabase() function in db.js

  db.prepare(`
    CREATE TABLE IF NOT EXISTS trip_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 10),
      review_text TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(trip_id, user_id)
    )
  `).run();

  // voorbeeldaccounts toevoegen
  const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (count === 0) {
    console.log("Seeding example users...");

    const insertUser = db.prepare(
      "INSERT INTO users (name, email, passwordHash, bio, role) VALUES (?, ?, ?, ?, ?)"
    );

    const exampleUsers = [
      {
        name: "Peter",
        email: "peter@example.com",
        password: "password123",
        role: "admin",
        bio: "Explorer of hidden gems."
      },
      {
        name: "Jori",
        email: "jori@example.com",
        password: "password123",
        role: "user",
        bio: "This can be anything!"
      },
      {
        name: "Artuur",
        email: "artuur.heidbuchel@protonmail.com",
        password: "wachtwoord",
        role: "admin",
        bio: "Ik heb ook een bio!"
      }
    ];

    for (const user of exampleUsers) {
      const passwordHash = bcrypt.hashSync(user.password, 10);
      insertUser.run(user.name, user.email, passwordHash, user.bio, user.role);
    }

    console.log("Example users created.");
  }
}

// Add this function after InitializeDatabase()
export function SeedPlaceholderData() {
  // Check if data already exists
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount > 3) {
    console.log("Placeholder data already exists, skipping seed...");
    return;
  }

  console.log("Seeding placeholder data...");

  // Get existing users
  const artuur = getUserByEmail("artuur.heidbuchel@protonmail.com");
  const peter = getUserByEmail("peter@example.com");
  const jori = getUserByEmail("jori@example.com");

  // Update bios for existing users
  db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(
    "TravelBuddy developer??",
    artuur.id
  );
  db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(
    "Weekend hiker and coffee lover ☕ Always planning the next trip!",
    peter.id
  );

  // Create additional users for variety
  const additionalUsers = [
    {
      name: "Emma",
      email: "emma@example.com",
      password: "password123",
      bio: "Beach lover and sunset chaser 🌅"
    },
    {
      name: "Lucas",
      email: "lucas@example.com",
      password: "password123",
      bio: "Mountain climber seeking new peaks ⛰️"
    },
    {
      name: "Sophie",
      email: "sophie@example.com",
      password: "password123",
      bio: "City explorer and food critic 🍕"
    },
    {
      name: "Noah",
      email: "noah@example.com",
      password: "password123",
      bio: "Road trip enthusiast with a camper van 🚐"
    }
  ];

  const newUserIds = [];
  for (const user of additionalUsers) {
    const passwordHash = bcrypt.hashSync(user.password, 10);
    const result = db.prepare(
      "INSERT INTO users (name, email, passwordHash, bio, role) VALUES (?, ?, ?, ?, 'user')"
    ).run(user.name, user.email, passwordHash, user.bio);
    newUserIds.push(result.lastInsertRowid);
  }

  const [emmaId, lucasId, sophieId, noahId] = newUserIds;

  // Create friendships (bidirectional)
  const friendships = [
    [artuur.id, peter.id],
    [artuur.id, jori.id],
    [artuur.id, emmaId],
    [artuur.id, lucasId],
    [peter.id, jori.id],
    [peter.id, sophieId],
    [jori.id, emmaId],
    [emmaId, lucasId],
    [sophieId, noahId]
  ];

  for (const [user1, user2] of friendships) {
    try {
      db.prepare("INSERT INTO friends (user_id, friend_id) VALUES (?, ?)").run(user1, user2);
      db.prepare("INSERT INTO friends (user_id, friend_id) VALUES (?, ?)").run(user2, user1);
    } catch (e) {
      // Skip if already exists
    }
  }

  // Create pending friend request for Artuur
  try {
    db.prepare(
      "INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')"
    ).run(sophieId, artuur.id);
  } catch (e) {}

  // GROUP 1: Solo showcase group (Artuur only)
  const soloGroupId = createGroup(
    "My Personal Adventures",
    "A private space for planning my solo trips and adventures",
    artuur.id
  );

  const soloTripId = createTrip(
    soloGroupId,
    "Iceland Road Trip",
    "Iceland",
    "2025-08-15",
    "2025-08-25"
  );

  // Activities for solo trip
  createActivity(
    soloTripId,
    "Golden Circle Tour",
    "Visit Þingvellir, Geysir, and Gullfoss waterfall",
    "Golden Circle, Iceland",
    64.3271,
    -20.1199,
    "2025-08-16",
    "09:00",
    "17:00",
    artuur.id
  );

  createActivity(
    soloTripId,
    "Blue Lagoon Spa",
    "Relax in the famous geothermal spa",
    "Blue Lagoon, Grindavík",
    63.8804,
    -22.4495,
    "2025-08-17",
    "14:00",
    "18:00",
    artuur.id
  );

  // GROUP 2: Main showcase group (Artuur, Peter, Jori, Emma)
  const mainGroupId = createGroup(
    "Summer Squad ☀️",
    "Friends planning epic summer adventures together!",
    artuur.id
  );

  addGroupMember(mainGroupId, peter.id, "admin");
  addGroupMember(mainGroupId, jori.id, "member");
  addGroupMember(mainGroupId, emmaId, "member");

  // Trip 1: Upcoming Barcelona trip (main showcase)
  const barcelonaTripId = createTrip(
    mainGroupId,
    "Barcelona Adventure",
    "Barcelona, Spain",
    "2025-07-10",
    "2025-07-17"
  );

  // Confirmed activities
  createActivity(
    barcelonaTripId,
    "Sagrada Familia Visit",
    "Tour Gaudí's masterpiece basilica with pre-booked tickets",
    "Sagrada Família, Barcelona",
    41.4036,
    2.1744,
    "2025-07-11",
    "10:00",
    "13:00",
    artuur.id
  );

  createActivity(
    barcelonaTripId,
    "Beach Day at Barceloneta",
    "Relax, swim, and enjoy beachside paella",
    "Barceloneta Beach",
    41.3809,
    2.1896,
    "2025-07-12",
    "11:00",
    "18:00",
    peter.id
  );

  createActivity(
    barcelonaTripId,
    "Park Güell Exploration",
    "Morning visit to Gaudí's colorful park",
    "Park Güell, Barcelona",
    41.4145,
    2.1527,
    "2025-07-13",
    "09:00",
    "12:00",
    jori.id
  );

  createActivity(
    barcelonaTripId,
    "Tapas Tour in Gothic Quarter",
    "Evening tapas bar hopping with local guide",
    "Gothic Quarter, Barcelona",
    41.3826,
    2.1769,
    "2025-07-13",
    "19:00",
    "23:00",
    emmaId
  );

  createActivity(
    barcelonaTripId,
    "Montjuïc Cable Car & Castle",
    "Ride cable car and explore historic castle with city views",
    "Montjuïc Castle",
    41.3644,
    2.1660,
    "2025-07-14",
    "14:00",
    "18:00",
    artuur.id
  );

  // Activity suggestions with votes
  const suggestion1 = createActivitySuggestion(
    barcelonaTripId,
    "FC Barcelona Stadium Tour",
    "Visit Camp Nou and the FC Barcelona museum",
    "Camp Nou, Barcelona",
    41.3809,
    2.1228,
    "2025-07-15",
    "10:00",
    "13:00",
    peter.id
  );

  const suggestion2 = createActivitySuggestion(
    barcelonaTripId,
    "Flamenco Show",
    "Authentic flamenco performance with dinner",
    "Tablao Flamenco Cordobes",
    41.3788,
    2.1746,
    "2025-07-15",
    "20:00",
    "23:00",
    emmaId
  );

  const suggestion3 = createActivitySuggestion(
    barcelonaTripId,
    "Day Trip to Montserrat",
    "Visit the mountain monastery and enjoy hiking",
    "Montserrat, Spain",
    41.5933,
    1.8384,
    "2025-07-16",
    "08:00",
    "18:00",
    jori.id
  );

  // Cast votes on suggestions
  castVote(suggestion1, artuur.id, "yes");
  castVote(suggestion1, peter.id, "yes");
  castVote(suggestion1, jori.id, "yes");
  castVote(suggestion1, emmaId, "no");

  castVote(suggestion2, artuur.id, "yes");
  castVote(suggestion2, emmaId, "yes");
  castVote(suggestion2, peter.id, "no");

  castVote(suggestion3, artuur.id, "yes");
  castVote(suggestion3, jori.id, "yes");
  castVote(suggestion3, peter.id, "yes");
  castVote(suggestion3, emmaId, "yes");

  // Trip 2: Past trip with photos
  const parisTripId = createTrip(
    mainGroupId,
    "Paris Weekend",
    "Paris, France",
    "2024-11-15",
    "2024-11-18"
  );

  createActivity(
    parisTripId,
    "Eiffel Tower Visit",
    "Sunset view from the tower",
    "Eiffel Tower, Paris",
    48.8584,
    2.2945,
    "2024-11-15",
    "18:00",
    "21:00",
    artuur.id
  );

  createActivity(
    parisTripId,
    "Louvre Museum",
    "Full day exploring the museum collections",
    "Louvre Museum",
    48.8606,
    2.3376,
    "2024-11-16",
    "10:00",
    "17:00",
    peter.id
  );

  // GROUP 3: Another group with different members
  const hikingGroupId = createGroup(
    "Mountain Lovers 🏔️",
    "For those who love hiking and mountain adventures",
    peter.id
  );

  addGroupMember(hikingGroupId, artuur.id, "admin");
  addGroupMember(hikingGroupId, lucasId, "member");
  addGroupMember(hikingGroupId, noahId, "member");

  const alpsTrip = createTrip(
    hikingGroupId,
    "Swiss Alps Hiking",
    "Swiss Alps",
    "2025-09-05",
    "2025-09-12"
  );

  createActivity(
    alpsTrip,
    "Matterhorn Base Hike",
    "Trek to the base of the iconic mountain",
    "Zermatt, Switzerland",
    45.9763,
    7.6586,
    "2025-09-06",
    "07:00",
    "16:00",
    peter.id
  );

  // GROUP 4: City explorers group
  const cityGroupId = createGroup(
    "City Hoppers 🌆",
    "Urban adventures and city explorations",
    jori.id
  );

  addGroupMember(cityGroupId, artuur.id, "member");
  addGroupMember(cityGroupId, sophieId, "admin");
  addGroupMember(cityGroupId, emmaId, "member");

  const tokyoTrip = createTrip(
    cityGroupId,
    "Tokyo Discovery",
    "Tokyo, Japan",
    "2026-03-20",
    "2026-03-28"
  );

  createActivity(
    tokyoTrip,
    "Shibuya Crossing & Shopping",
    "Experience the famous crossing and explore shops",
    "Shibuya, Tokyo",
    35.6595,
    139.7004,
    "2026-03-21",
    "14:00",
    "19:00",
    sophieId
  );

  createActivity(
    tokyoTrip,
    "TeamLab Borderless",
    "Interactive digital art museum experience",
    "TeamLab, Tokyo",
    35.6247,
    139.7781,
    "2026-03-22",
    "10:00",
    "13:00",
    jori.id
  );

  const sushiSuggestion = createActivitySuggestion(
    tokyoTrip,
    "Tsukiji Outer Market Food Tour",
    "Early morning sushi and street food tasting",
    "Tsukiji, Tokyo",
    35.6654,
    139.7707,
    "2026-03-23",
    "06:00",
    "10:00",
    artuur.id
  );

  castVote(sushiSuggestion, sophieId, "yes");
  castVote(sushiSuggestion, emmaId, "yes");

  console.log("✅ Placeholder data seeded successfully!");
  console.log(`   - ${friendships.length} friendships created`);
  console.log(`   - 4 groups created`);
  console.log(`   - 5 trips with activities and suggestions`);
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
    SELECT u.id, u.name, u.email, u.profile_picture
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

export function getAllUsers() {
  return db.prepare("SELECT id, name, email, role FROM users ORDER BY id ASC").all();
}

export function promoteUserToAdmin(userId) {
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(userId);
  return { success: true, message: "User promoted to admin." };
}

export function demoteUserToUser(userId) {
  db.prepare("UPDATE users SET role = 'user' WHERE id = ?").run(userId);
  return { success: true, message: "Admin demoted to user." };
}

export function deleteUserHard(userId) {
  // verwijder uit alle gerelateerde tabellen
  db.prepare("DELETE FROM friends WHERE user_id = ? OR friend_id = ?").run(userId, userId);
  db.prepare("DELETE FROM friend_requests WHERE sender_id = ? OR receiver_id = ?").run(userId, userId);
  db.prepare("DELETE FROM group_members WHERE user_id = ?").run(userId);
  
  // Verwijder activiteiten die hij heeft aangemaakt
  db.prepare("DELETE FROM activities WHERE created_by = ?").run(userId);

  // Verwijder groepen waarvan hij eigenaar is (optioneel, maakt het eenvoudig)
  db.prepare("DELETE FROM groups WHERE owner_id = ?").run(userId);

  // tenslotte user zelf
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);

  return { success: true, message: "User permanently deleted." };
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

export function createTripPhoto(tripId, filename, originalFilename, filePath, fileType, fileSize, uploadedBy, caption = null, source = 'upload', googlePhotoId = null) {
  const stmt = db.prepare(`
    INSERT INTO trip_photos (trip_id, filename, original_filename, file_path, file_type, file_size, caption, uploaded_by, source, google_photo_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(tripId, filename, originalFilename, filePath, fileType, fileSize, caption, uploadedBy, source, googlePhotoId);
  return result.lastInsertRowid;
}

export function getTripPhotos(tripId) {
  return db.prepare(`
    SELECT p.*, u.name as uploader_name, u.profile_picture as uploader_picture
    FROM trip_photos p
    LEFT JOIN users u ON u.id = p.uploaded_by
    WHERE p.trip_id = ?
    ORDER BY p.uploaded_at DESC
  `).all(tripId);
}

export function getPhotoById(photoId) {
  return db.prepare("SELECT * FROM trip_photos WHERE id = ?").get(photoId);
}

export function updatePhotoCaption(photoId, caption) {
  db.prepare("UPDATE trip_photos SET caption = ? WHERE id = ?").run(caption, photoId);
}

export function deleteTripPhoto(photoId) {
  db.prepare("DELETE FROM trip_photos WHERE id = ?").run(photoId);
}

export function getPhotoStats(tripId) {
  return db.prepare(`
    SELECT 
      COUNT(*) as total_photos,
      SUM(file_size) as total_size,
      COUNT(DISTINCT uploaded_by) as contributors
    FROM trip_photos
    WHERE trip_id = ?
  `).get(tripId);
}

export default db;

// Create a review (only if trip has ended)
export function createTripReview(tripId, userId, rating, reviewText) {
  const trip = getTripById(tripId);
  if (!trip) return { success: false, message: "Trip not found" };
  
  // Check if trip has ended
  const today = new Date().toISOString().split('T')[0];
  if (trip.end_date >= today) {
    return { success: false, message: "Cannot review a trip that hasn't ended yet" };
  }
  
  // Check if user is a member of the group
  const membership = isGroupMember(userId, trip.group_id);
  if (!membership) {
    return { success: false, message: "You must be a group member to review this trip" };
  }
  
  const stmt = db.prepare(`
    INSERT INTO trip_reviews (trip_id, user_id, rating, review_text)
    VALUES (?, ?, ?, ?)
  `);
  
  try {
    const result = stmt.run(tripId, userId, rating, reviewText);
    return { success: true, reviewId: result.lastInsertRowid };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return { success: false, message: "You have already reviewed this trip" };
    }
    return { success: false, message: "Failed to create review" };
  }
}

// Get reviews for a specific trip
export function getTripReviews(tripId) {
  return db.prepare(`
    SELECT 
      r.*,
      u.name as reviewer_name,
      u.profile_picture as reviewer_picture
    FROM trip_reviews r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.trip_id = ?
    ORDER BY r.created_at DESC
  `).all(tripId);
}

// Get the 4 most recent reviews for homepage
export function getRecentReviews(limit = 4) {
  return db.prepare(`
    SELECT 
      r.*,
      u.name as reviewer_name,
      u.profile_picture as reviewer_picture,
      t.name as trip_name,
      t.destination,
      t.start_date,
      t.end_date
    FROM trip_reviews r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN trips t ON t.id = r.trip_id
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(limit);
}

// Get average rating for a trip
export function getTripAverageRating(tripId) {
  return db.prepare(`
    SELECT 
      AVG(rating) as avg_rating,
      COUNT(*) as review_count
    FROM trip_reviews
    WHERE trip_id = ?
  `).get(tripId);
}

// Check if user has reviewed a trip
export function hasUserReviewedTrip(tripId, userId) {
  const review = db.prepare(`
    SELECT id FROM trip_reviews
    WHERE trip_id = ? AND user_id = ?
  `).get(tripId, userId);
  return !!review;
}

// Update a review
export function updateTripReview(reviewId, userId, rating, reviewText) {
  const stmt = db.prepare(`
    UPDATE trip_reviews
    SET rating = ?, review_text = ?
    WHERE id = ? AND user_id = ?
  `);
  const result = stmt.run(rating, reviewText, reviewId, userId);
  
  if (result.changes === 0) {
    return { success: false, message: "Review not found or unauthorized" };
  }
  return { success: true };
}

// Delete a review
export function deleteTripReview(reviewId, userId) {
  const stmt = db.prepare(`
    DELETE FROM trip_reviews
    WHERE id = ? AND user_id = ?
  `);
  const result = stmt.run(reviewId, userId);
  
  if (result.changes === 0) {
    return { success: false, message: "Review not found or unauthorized" };
  }
  return { success: true };
}
