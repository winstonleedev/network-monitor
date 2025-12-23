const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

const dbDirectory = path.dirname(config.databasePath);
if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

const db = new Database(config.databasePath);

const initSql = `
  CREATE TABLE IF NOT EXISTS ping_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp_ms INTEGER NOT NULL,
    success INTEGER NOT NULL,
    duration_ms REAL,
    message TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_ping_results_timestamp ON ping_results(timestamp_ms);
`;

db.exec(initSql);

const insertStmt = db.prepare(
  'INSERT INTO ping_results (timestamp_ms, success, duration_ms, message) VALUES (@timestamp_ms, @success, @duration_ms, @message)'
);

const selectStmt = db.prepare(
  'SELECT timestamp_ms, success, duration_ms, message FROM ping_results WHERE timestamp_ms BETWEEN ? AND ? ORDER BY timestamp_ms ASC'
);

function recordPingResult({ timestampMs, success, durationMs, message }) {
  insertStmt.run({
    timestamp_ms: timestampMs,
    success: success ? 1 : 0,
    duration_ms: typeof durationMs === 'number' ? durationMs : null,
    message: message || null,
  });
}

function fetchResults(startMs, endMs) {
  return selectStmt.all(startMs, endMs).map((row) => ({
    timestampMs: row.timestamp_ms,
    success: Boolean(row.success),
    durationMs: row.duration_ms,
    message: row.message,
  }));
}

module.exports = {
  recordPingResult,
  fetchResults,
  db,
};
