import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// Path naar je SQLite database
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "database.db"); // pas dit aan als je DB een andere naam heeft

const db = new Database(dbPath);

// Controleer eerst of kolommen al bestaan
const info = db.prepare("PRAGMA table_info(activities)").all();
const columnNames = info.map(c => c.name);

if (!columnNames.includes("start_time")) {
  db.prepare("ALTER TABLE activities ADD COLUMN start_time TEXT").run();
  console.log("Kolom start_time toegevoegd");
} else {
  console.log("Kolom start_time bestaat al");
}

if (!columnNames.includes("end_time")) {
  db.prepare("ALTER TABLE activities ADD COLUMN end_time TEXT").run();
  console.log("Kolom end_time toegevoegd");
} else {
  console.log("Kolom end_time bestaat al");
}

// Optioneel: bestaande 'time' kolom naar start_time kopiëren
if (columnNames.includes("time")) {
  db.prepare("UPDATE activities SET start_time = time WHERE start_time IS NULL").run();
  console.log("start_time gevuld met waarde van time");
}

console.log("Klaar!");
db.close();
