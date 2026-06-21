import express from "express";
import morgan from "morgan";                       // logging middleware
import cors from "cors";                            // CORS middleware
import session from "express-session";              // session middleware
import { check, validationResult } from "express-validator"; // validation middleware

import passport, { isLoggedIn } from "./auth.js";
import { listStations, listLines, listLineStations, listEvents } from "./dao-network.js";
import {
  createActiveGame, getActiveGame, deleteActiveGame,
  insertGame, insertGameSegment, getRanking,
} from "./dao-games.js";
import { buildGraph, pickEndpoints, validateRoute } from "./network.js";

//Constants 
const PORT = 3001;
const CLIENT_URL = "http://localhost:5173";
const INITIAL_COINS = 20;
const PLANNING_SECONDS = 90;

// Init express and set up the middlewares
const app = express();
app.use(morgan("dev"));
app.use(express.json());

// Set up and enable CORS
const corsOptions = {
  origin: CLIENT_URL,
  credentials: true,
};
app.use(cors(corsOptions));

// Set up the session 
app.use(
  session({
    secret: "last race - very secret session key",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.authenticate("session"));


// Handle validation errors (keep only the messages)
const onValidationErrors = (validation, res) => {
  const errors = validation.formatWith(errorFormatter);
  return res.status(422).json({ validationErrors: errors.mapped() });
};
const errorFormatter = ({ msg }) => msg;

// Load the whole network and build the in-memory graph
async function loadNetwork() {
  const [stations, lines, lineStations] = await Promise.all([
    listStations(),
    listLines(),
    listLineStations(),
  ]);
  return buildGraph(stations, lines, lineStations);
}

// Users APIs 

// POST /api/sessions  — login
app.post(
  "/api/sessions",
  [check("username").isString().notEmpty(), check("password").isString().notEmpty()],
  function (req, res, next) {
    const invalid = validationResult(req);
    if (!invalid.isEmpty()) return onValidationErrors(invalid, res);

    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info });
      req.login(user, (err) => {
        if (err) return next(err);
        return res.json(req.user); // {id, username}
      });
    })(req, res, next);
  }
);

// GET /api/sessions/current  — is the user logged in?
app.get("/api/sessions/current", (req, res) => {
  if (req.isAuthenticated()) res.status(200).json(req.user);
  else res.status(401).json({ error: "Not authenticated" });
});

// DELETE /api/sessions/current  — logout
app.delete("/api/sessions/current", (req, res) => {
  req.logout(() => res.end());
});

// Network APIs 

// GET /api/network/full  — full network (Setup phase): stations, lines (with colour + ordered stops), interchanges
app.get("/api/network/full", isLoggedIn, async (req, res) => {
  try {
    const net = await loadNetwork();
    res.json({
      stations: net.stations,
      lines: net.lines.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        stops: net.lineStops.get(l.id),
      })),
      interchanges: [...net.interchanges],
    });
  } catch (err) {
    res.status(500).json({ error: `Database error: ${err}` });
  }
});

// GET /api/network/segments  — Planning phase: stations + segments only, NO line info, shuffled
app.get("/api/network/segments", isLoggedIn, async (req, res) => {
  try {
    const net = await loadNetwork();
    const segs = [...net.segments];
    // Fisher-Yates shuffle so the client cannot infer line membership from order.
    for (let i = segs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [segs[i], segs[j]] = [segs[j], segs[i]];
    }
    res.json({
      stations: net.stations,
      segments: segs.map((s) => ({ id: s.id, a: s.a, b: s.b })),
    });
  } catch (err) {
    res.status(500).json({ error: `Database error: ${err}` });
  }
});

// Games APIs 

// POST /api/games  — start a new game: pick endpoints, store deadline server-side
app.post("/api/games", isLoggedIn, async (req, res) => {
  try {
    const net = await loadNetwork();
    const { start, end } = pickEndpoints(net);

    // Fixed end-of-planning timestamp (now + 90s). The client derives its countdown from this.
    const deadlineMilliseconds = Date.now() + PLANNING_SECONDS * 1000;

    const gameId = await createActiveGame(req.user.id, start, end, deadlineMilliseconds);

    const names = Object.fromEntries(net.stations.map((s) => [s.id, s.name]));
    res.json({
      gameId,
      startStation: { id: start, name: names[start] },
      endStation: { id: end, name: names[end] },
      planningSeconds: PLANNING_SECONDS,
      deadlineMs: deadlineMilliseconds,
    });
  } catch (err) {
    res.status(500).json({ error: `Database error: ${err}` });
  }
});

// POST /api/games/:id/submit  — validate the route, run the events, save the result
app.post(
  "/api/games/:id/submit",
  isLoggedIn,
  [
    check("id").isInt({ min: 1 }),
    check("segmentIds").isArray(),
    check("segmentIds.*").isString(),
  ],
  async (req, res) => {
    const invalid = validationResult(req);
    if (!invalid.isEmpty()) return onValidationErrors(invalid, res);

    try {
      const gameId = Number(req.params.id);
      const active = await getActiveGame(gameId, req.user.id);
      if (!active) return res.status(404).json({ error: "Game not found" });

      const lateBy = Date.now() - active.deadline_ms;
      const submittedSegs = req.body.segmentIds;

      const net = await loadNetwork();
      const validation = validateRoute(
        net,
        active.start_station_id,
        active.end_station_id,
        submittedSegs
      );

      // Invalid/incomplete route -> skip execution, score 0
      if (!validation.valid) {
        const failedId = await insertGame(
          req.user.id, active.start_station_id, active.end_station_id, 0, "failed"
        );
        await deleteActiveGame(gameId);
        return res.json({
          valid: false,
          reason: lateBy > 0 ? `time expired (${validation.reason})` : validation.reason,
          score: 0,
          gameId: failedId,
          steps: [],
        });
      }

      // Execute: one random event per segment
      const events = await listEvents();
      const names = Object.fromEntries(net.stations.map((s) => [s.id, s.name]));
      const ordered = validation.orderedStations;

      let coins = INITIAL_COINS;
      const steps = [];
      for (let i = 0; i < submittedSegs.length; i++) {
        const evt = events[Math.floor(Math.random() * events.length)];
        coins += evt.effect;
        steps.push({
          step: i + 1,
          from: { id: ordered[i], name: names[ordered[i]] },
          to: { id: ordered[i + 1], name: names[ordered[i + 1]] },
          event: { id: evt.id, description: evt.description, effect: evt.effect },
          coinsAfter: coins,
        });
      }
      const finalScore = Math.max(0, coins);

      // Persist the completed game and its segments.
      const newGameId = await insertGame(
        req.user.id, active.start_station_id, active.end_station_id, finalScore, "completed"
      );
      for (const s of steps) {
        await insertGameSegment(newGameId, s.step, s.from.id, s.to.id, s.event.id, s.coinsAfter);
      }
      await deleteActiveGame(gameId);

      res.json({
        valid: true,
        gameId: newGameId,
        initialCoins: INITIAL_COINS,
        steps,
        score: finalScore,
      });
    } catch (err) {
      res.status(500).json({ error: `Database error: ${err}` });
    }
  }
);

// GET /api/ranking  — best score per player, descending
app.get("/api/ranking", isLoggedIn, async (req, res) => {
  try {
    const rows = await getRanking();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: `Database error: ${err}` });
  }
});

/*** Activating the server ***/
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/`));
