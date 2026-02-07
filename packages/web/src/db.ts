import { Database } from "bun:sqlite";

export function createDb(path = "chat.db") {
  const db = new Database(path);
  db.run("PRAGMA journal_mode = WAL");
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )
  `);
  return db;
}
