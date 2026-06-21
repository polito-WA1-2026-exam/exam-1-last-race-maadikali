// DAO module for games, game segments and the active (in-progress) game

import db from "./db.js";

// Active (in-progress) game
export const createActiveGame = (userId, startId, endId, deadlineMilliseconds) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO active_games (user_id, start_station_id, end_station_id, deadline_ms)
                 VALUES (?, ?, ?, ?)`;
    db.run(sql, [userId, startId, endId, deadlineMilliseconds], function (err) {
      if (err) reject(err);
      else resolve(this.lastID); // sqlite3 exposes the new id on `this`
    });
  });
};

export const getActiveGame = (id, userId) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM active_games WHERE id = ? AND user_id = ?";
    db.get(sql, [id, userId], (err, row) => (err ? reject(err) : resolve(row)));
  });
};

export const deleteActiveGame = (id) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM active_games WHERE id = ?", [id], (err) =>
      err ? reject(err) : resolve(true)
    );
  });
};

// Finished games
export const insertGame = (userId, startId, endId, score, status) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO games (user_id, start_station_id, end_station_id, score, status)
                 VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [userId, startId, endId, score, status], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

export const insertGameSegment = (gameId, step, fromId, toId, eventId, coinsAfter) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO game_segments (game_id, step, from_station_id, to_station_id, event_id, coins_after)
                 VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [gameId, step, fromId, toId, eventId, coinsAfter], (err) =>
      err ? reject(err) : resolve(true)
    );
  });
};

// Queries for the UI 
export const listUserGames = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT g.id, g.score, g.status, g.created_at,
                        s1.name AS start_name, s2.name AS end_name
                 FROM games g
                 JOIN stations s1 ON s1.id = g.start_station_id
                 JOIN stations s2 ON s2.id = g.end_station_id
                 WHERE g.user_id = ?
                 ORDER BY g.created_at DESC, g.id DESC`;
    db.all(sql, [userId], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};

export const getRanking = () => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT u.username, MAX(g.score) AS best_score, COUNT(g.id) AS games_played
                 FROM users u
                 JOIN games g ON g.user_id = u.id
                 GROUP BY u.id, u.username
                 ORDER BY best_score DESC, u.username ASC`;
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};
