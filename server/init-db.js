import sqlite3 from "sqlite3";
import crypto from "crypto";
import fs from "fs";

const FILE = "lastrace.sqlite";
for (const f of [FILE, FILE + "-wal", FILE + "-shm"]) { try { fs.unlinkSync(f); } catch {} }

const db = new sqlite3.Database(FILE);

// 1. Seed data 

// 4 metro lines (name + colour)
const LINES = [
  { name: "Orange Line", color: "#F39C12" },
  { name: "Blue Line",   color: "#2980B9" },
  { name: "Green Line",  color: "#27AE60" },
  { name: "Pink Line",   color: "#EC4899" },
];

// Each line's stops in order (this order is what defines the segments)
const LINE_STOPS = {
  "Orange Line": ["Keruen", "Talan Towers", "Altyn Dala", "Zhetysu", "Dauir"],
  "Blue Line":   ["Ortalyk", "Jana Kala", "Altyn Dala", "Syganak", "Zhibek Zholy"],
  "Green Line":  ["Alpamys", "Mangilik Yel", "Dauir", "Barys Arena", "Nurly Olke"],
  "Pink Line":   ["Turan", "Esil Plaza", "Syganak", "Galamat Sayabak", "Barys Arena"],
};

// 10 random events (description + effect, each effect is between -4 and +4)
const EVENTS = [
  { description: "Dombra busker fills the carriage with a kuy", effect: 2 },
  { description: "Elder shares warm shelpek for the road",      effect: 1 },
  { description: "Steppe wind delays the doors at Saryarka",    effect: -1 },
  { description: "Buran snowstorm freezes the track switches",  effect: -4 },
  { description: "Turnstile swallows your transit card",        effect: -2 },
  { description: "Nauryz parade hands out free kozhe",          effect: 4 },
  { description: "A tenge note flutters onto the empty seat",   effect: 3 },
  { description: "Lost in the bazaar crowd near Barys Arena",   effect: -3 },
  { description: "Conductor waves you through with a nod",      effect: 0 },
  { description: "Wrong platform during the Esil rush hour",    effect: -2 },
];

// 3 registered users (plain passwords here are hashed before storing)
const USERS = [
  { username: "Erasyl",  password: "Erasyl2004" },
  { username: "Azamat",  password: "Azamat2005" },
  { username: "Ayazhan", password: "Ayazhan2006" },
];

// Seed games so the ranking is populated (Erasyl=user 1 and Azamat=user 2 have played)
const GAMES = [
  { user: 1, start: "Keruen",     end: "Zhibek Zholy", score: 24, daysAgo: 3 },
  { user: 1, start: "Turan",      end: "Nurly Olke",   score: 18, daysAgo: 2 },
  { user: 1, start: "Alpamys",    end: "Zhetysu",      score: 27, daysAgo: 1 },
  { user: 2, start: "Ortalyk",    end: "Barys Arena",  score: 15, daysAgo: 4 },
  { user: 2, start: "Keruen",     end: "Nurly Olke",   score: 22, daysAgo: 2 },
  { user: 2, start: "Esil Plaza", end: "Mangilik Yel", score: 9,  daysAgo: 1 },
];

//2. CREATE TABLES + INSERT 
// db.serialize() runs the statements one after another, in order.
db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");

  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    hash TEXT NOT NULL,
    salt TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`);
  db.run(`CREATE TABLE line_stations (
    line_id INTEGER NOT NULL REFERENCES lines(id),
    station_id INTEGER NOT NULL REFERENCES stations(id),
    position INTEGER NOT NULL,
    PRIMARY KEY (line_id, position),
    UNIQUE (line_id, station_id)
  )`);
  db.run(`CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    effect INTEGER NOT NULL CHECK (effect BETWEEN -4 AND 4)
  )`);
  db.run(`CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    start_station_id INTEGER NOT NULL REFERENCES stations(id),
    end_station_id INTEGER NOT NULL REFERENCES stations(id),
    score INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed','failed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE game_segments (
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    step INTEGER NOT NULL,
    from_station_id INTEGER NOT NULL REFERENCES stations(id),
    to_station_id INTEGER NOT NULL REFERENCES stations(id),
    event_id INTEGER NOT NULL REFERENCES events(id),
    coins_after INTEGER NOT NULL,
    PRIMARY KEY (game_id, step)
  )`);
  db.run(`CREATE TABLE active_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    start_station_id INTEGER NOT NULL REFERENCES stations(id),
    end_station_id INTEGER NOT NULL REFERENCES stations(id),
    deadline_ms INTEGER NOT NULL
  )`);

  // Users (hash each password with scrypt + a random salt variable)
  const insUser = db.prepare("INSERT INTO users (username, hash, salt) VALUES (?, ?, ?)");
  for (const u of USERS) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(u.password, salt, 32).toString("hex");
    insUser.run(u.username, hash, salt);
  }
  insUser.finalize();
  //Lines 
  const insLine = db.prepare("INSERT INTO lines (name, color) VALUES (?, ?)");
  for (const l of LINES) insLine.run(l.name, l.color);
  insLine.finalize();

  //Stations (unique list, collected from all the line stops) 
  const stationNames = [...new Set(Object.values(LINE_STOPS).flat())];
  const insStation = db.prepare("INSERT INTO stations (name) VALUES (?)");
  for (const name of stationNames) insStation.run(name);
  insStation.finalize();

  // Line_stations (each stop of each line, with its position/order) 

  // Look up the line id and station id by name, then insert the position.
  const insLS = db.prepare(`INSERT INTO line_stations (line_id, station_id, position)
    VALUES ((SELECT id FROM lines WHERE name = ?), (SELECT id FROM stations WHERE name = ?), ?)`);
  for (const lineName of Object.keys(LINE_STOPS)) {
    LINE_STOPS[lineName].forEach((stationName, position) => {
      insLS.run(lineName, stationName, position);
    });
  }
  insLS.finalize();

  // Events
  const insEvent = db.prepare("INSERT INTO events (description, effect) VALUES (?, ?)");
  for (const e of EVENTS) insEvent.run(e.description, e.effect);
  insEvent.finalize();

  // Seed games (look up start/end station ids by name)
  const insGame = db.prepare(`INSERT INTO games (user_id, start_station_id, end_station_id, score, status, created_at)
    VALUES (?, (SELECT id FROM stations WHERE name = ?), (SELECT id FROM stations WHERE name = ?), ?, 'completed', datetime('now', ?))`);
  for (const g of GAMES) insGame.run(g.user, g.start, g.end, g.score, `-${g.daysAgo} days`);
  insGame.finalize();
});

db.close((err) => {
  if (err) console.error(err);
  else console.log("Seeded lastrace.sqlite (users, lines, stations, line_stations, events, games).");
});
