import Database from "better-sqlite3";

const db = new Database("database.db", { verbose: console.log });

export function InitializeDatabase() {
  db.pragma("journal_mode = WAL;");
  db.pragma("busy_timeout = 5000;");
  db.pragma("synchronous = NORMAL;");
  db.pragma("cache_size = 1000000000;");
  db.pragma("foreign_keys = true;");
  db.pragma("temp_store = memory;");

  db.prepare("CREATE TABLE IF NOT EXISTS users (name TEXT) STRICT").run();

  const exampleUsers = [
    { name: "Peter" },
    { name: "Jori" },
    { name: "Joris" },
    { name: "Mike" },
  ];
  const insertUser = db.prepare("INSERT INTO users (name) VALUES (?)");
  exampleUsers.forEach((user) => {
    insertUser.run(user.name);
  });
}
