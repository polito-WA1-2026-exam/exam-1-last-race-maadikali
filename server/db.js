// DB access module — opens the SQLite database

import sqlite3 from "sqlite3";

// The pre-seeded binary database is committed in the repository.
const db = new sqlite3.Database("lastrace.sqlite", (err) => {
  if (err) throw err;
});

// Enforce foreign keys for every connection.
db.run("PRAGMA foreign_keys = ON");

export default db;
