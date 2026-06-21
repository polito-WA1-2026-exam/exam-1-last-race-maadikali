// The DAO layer loads therows, this module turns them into a graph and validates routes)
 
/**
 * @param {Array} stations      [{id, name}]
 * @param {Array} lines         [{id, name, color}]
 * @param {Array} lineStations  [{line_id, station_id, position}] ordered
 * Returns { stations, lines, lineStops, segments, segmentLines, adj, interchanges }
 */
export function buildGraph(stations, lines, lineStations) {
  const lineStops = new Map();      // lineId -> [stationId,...] in order
  const stationLines = new Map();   // stationId -> Set(lineId)
  for (const s of stations) stationLines.set(s.id, new Set());
  for (const l of lines) lineStops.set(l.id, []);

  for (const row of lineStations) {
    lineStops.get(row.line_id).push(row.station_id);
    stationLines.get(row.station_id).add(row.line_id);
  }

  // Undirected, canonical segments "a-b" with a < b.
  const segMap = new Map();
  const adj = new Map();
  for (const s of stations) adj.set(s.id, new Map());

  for (const [lineId, stops] of lineStops.entries()) {
    for (let i = 0; i < stops.length - 1; i++) {
      const x = stops[i], y = stops[i + 1];
      const a = Math.min(x, y), b = Math.max(x, y);
      const key = `${a}-${b}`;
      if (!segMap.has(key)) segMap.set(key, { id: key, a, b, lines: new Set() });
      segMap.get(key).lines.add(lineId);
      if (!adj.get(x).has(y)) adj.get(x).set(y, new Set());
      if (!adj.get(y).has(x)) adj.get(y).set(x, new Set());
      adj.get(x).get(y).add(lineId);
      adj.get(y).get(x).add(lineId);
    }
  }

  const segments = [...segMap.values()].map((s) => ({ id: s.id, a: s.a, b: s.b }));
  const segmentLines = new Map([...segMap.values()].map((s) => [s.id, s.lines]));

  const interchanges = new Set();
  for (const [sid, set] of stationLines.entries()) {
    if (set.size > 1) interchanges.add(sid);
  }

  return { stations, lines, lineStops, segments, segmentLines, adj, interchanges };
}

//BFS shortest path length (edges) between two stations; Infinity if unreachable.
export function shortestPathLen(adj, src, dst) {
  if (src === dst) return 0;
  const queue = [src];
  const dist = new Map([[src, 0]]);
  while (queue.length) {
    const u = queue.shift();
    for (const v of adj.get(u).keys()) {
      if (!dist.has(v)) {
        dist.set(v, dist.get(u) + 1);
        if (v === dst) return dist.get(v);
        queue.push(v);
      }
    }
  }
  return Infinity;
}

//Picks a random (start, end) pair at least 3 segments apart
export function pickEndpoints(net) {
  const ids = net.stations.map((s) => s.id);
  for (let tries = 0; tries < 500; tries++) {
    const a = ids[Math.floor(Math.random() * ids.length)];
    const b = ids[Math.floor(Math.random() * ids.length)];
    if (a === b) continue;
    if (shortestPathLen(net.adj, a, b) >= 3) return { start: a, end: b };
  }
  return { start: ids[0], end: ids[ids.length - 1] }; // deterministic fallback
}

//Validates an ordered list of segment ids submitted by the player.
//Returns { valid, reason?, orderedStations? }.
//Starts at start, ends at end, segments are connected and never reused,
//and a line change (segments share no common line) is only allowed at an interchange

export function validateRoute(net, startId, endId, segmentIds) {
  if (!Array.isArray(segmentIds) || segmentIds.length === 0)
    return { valid: false, reason: "empty route" };

  const seen = new Set();
  for (const id of segmentIds) {
    if (seen.has(id)) return { valid: false, reason: "segment reused" };
    seen.add(id);
  }

  const segs = [];
  for (const id of segmentIds) {
    const lineSet = net.segmentLines.get(id);
    if (!lineSet) return { valid: false, reason: `unknown segment ${id}` };
    const [a, b] = id.split("-").map(Number);
    segs.push({ id, a, b, lines: lineSet });
  }

  const orderedStations = [];
  let current;
  if (segs[0].a === startId) current = segs[0].a;
  else if (segs[0].b === startId) current = segs[0].b;
  else return { valid: false, reason: "route does not start at the assigned station" };

  orderedStations.push(current);
  let activeLines = new Set(segs[0].lines);
  let next = segs[0].a === current ? segs[0].b : segs[0].a;
  orderedStations.push(next);
  current = next;

  for (let i = 1; i < segs.length; i++) {
    const s = segs[i];
    if (s.a !== current && s.b !== current)
      return { valid: false, reason: "segments not connected" };

    const intersection = new Set([...activeLines].filter((l) => s.lines.has(l)));
    if (intersection.size === 0) {
      // a line change happens at `current` -> must be an interchange
      if (!net.interchanges.has(current))
        return { valid: false, reason: "line change only allowed at an interchange station" };
      activeLines = new Set(s.lines);
    } else {
      activeLines = intersection;
    }
    next = s.a === current ? s.b : s.a;
    orderedStations.push(next);
    current = next;
  }

  if (current !== endId)
    return { valid: false, reason: "route does not end at the assigned station" };

  return { valid: true, orderedStations };
}
