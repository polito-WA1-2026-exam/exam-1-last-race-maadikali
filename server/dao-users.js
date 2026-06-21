// Data Access Object (DAO) module for accessing user data

import db from "./db.js";
import crypto from "crypto";

// Retrieve a user given its id (used by passport.deserializeUser).
export const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, username FROM users WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) reject(err);
      else if (row === undefined) resolve({ error: "User not found." });
      else resolve({ id: row.id, username: row.username });
    });
  });
};

// Verify username + password. Resolves to the user object on success, false otherwise.
export const getUserByCredentials = (username, password) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM users WHERE username = ?";
    db.get(sql, [username], (err, row) => {
      if (err) {
        reject(err);
      } else if (row === undefined) {
        resolve(false);
      } else {
        const user = { id: row.id, username: row.username };
        // The password check is done with an async, CPU-bound operation
        // (scrypt) so the event loop is not blocked.
        crypto.scrypt(password, row.salt, 32, (err, hashedPassword) => {
          if (err) reject(err);
          else if (!crypto.timingSafeEqual(Buffer.from(row.hash, "hex"), hashedPassword))
            resolve(false);
          else resolve(user);
        });
      }
    });
  });
};
