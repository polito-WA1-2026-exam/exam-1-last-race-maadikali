// DAO module for the metro network (stations, lines, line stops, events) 

import db from "./db.js";

export const listStations = () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, name FROM stations ORDER BY id";
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};

export const listLines = () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, name, color FROM lines ORDER BY id";
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};

export const listLineStations = () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT line_id, station_id, position FROM line_stations ORDER BY line_id, position";
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};

export const listEvents = () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, description, effect FROM events";
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};
