const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    proposer_employee_id TEXT NOT NULL,
    proposer_name TEXT NOT NULL,
    team TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gift_id INTEGER NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL,
    voter_name TEXT,
    team TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(gift_id, employee_id)
  );
`);

module.exports = db;
