export function buildGraph(stations, lines, lineStations) {

  // 1. group the stations of each line, keeping their order
  const lineStops = {};                       // lineId -> [stationId, stationId, ...]
  for (const line of lines) lineStops[line.id] = [];
  for (const row of lineStations) lineStops[row.line_id].push(row.station_id);

  // 2. make the segments. A segment is just two stations that are next to each
  //    other on a line. Each segment remembers which line it belongs to.
  const segments = [];                        // [{id, a, b, lineId}]
  const segmentById = {};                     // "a-b" -> the segment
  for (const lineId of Object.keys(lineStops)) {
    const stops = lineStops[lineId];
    for (let i = 0; i < stops.length - 1; i++) {
      const first = stops[i];
      const second = stops[i + 1];
      const a = Math.min(first, second);      // put the smaller id first, so the
      const b = Math.max(first, second);      // segment always has the same name
      const id = a + "-" + b;
      if (!segmentById[id]) {
        const seg = { id, a, b, lineId: Number(lineId) };
        segmentById[id] = seg;
        segments.push(seg);
      }
    }
  }

  // 3. interchanges are stations that belong to more than one line
  const linesPerStation = {};                 // stationId -> how many lines pass it
  for (const row of lineStations) {
    linesPerStation[row.station_id] = (linesPerStation[row.station_id] || 0) + 1;
  }
  const interchanges = new Set();
  for (const stationId of Object.keys(linesPerStation)) {
    if (linesPerStation[stationId] > 1) interchanges.add(Number(stationId));
  }

  // 4. neighbours: for each station, the list of stations directly connected to it.
  //    (used later to measure the distance between two stations)
  const neighbours = {};                      // stationId -> [stationId, ...]
  for (const s of stations) neighbours[s.id] = [];
  for (const seg of segments) {
    neighbours[seg.a].push(seg.b);
    neighbours[seg.b].push(seg.a);
  }

  return { stations, lines, lineStops, segments, segmentById, interchanges, neighbours };
}

// Find the shortest number of segments between two stations, using BFS.
// BFS visits stations level by level, so the first time we reach the end station
// we know it is the shortest distance. Returns Infinity if they are not connected.
export function shortestPathLen(neighbours, start, end) {
  if (start === end) return 0;
  const queue = [start];
  const distance = {};                        // stationId -> distance from start
  distance[start] = 0;
  while (queue.length > 0) {
    const station = queue.shift();
    for (const next of neighbours[station]) {
      if (distance[next] === undefined) {     // not visited yet
        distance[next] = distance[station] + 1;
        if (next === end) return distance[next];
        queue.push(next);
      }
    }
  }
  return Infinity;
}

// Pick a random start and end station that are at least 3 segments apart.
export function pickEndpoints(net) {
  const ids = net.stations.map(s => s.id);
  for (let tries = 0; tries < 500; tries++) {
    const start = ids[Math.floor(Math.random() * ids.length)];
    const end = ids[Math.floor(Math.random() * ids.length)];
    if (start === end) continue;
    if (shortestPathLen(net.neighbours, start, end) >= 3) {
      return { start, end };
    }
  }
  // fallback, just in case (should not normally happen)
  return { start: ids[0], end: ids[ids.length - 1] };
}

// Check the route the player built. It is a list of segment ids in travel order.
// Returns { valid: true, orderedStations } or { valid: false, reason }.
export function validateRoute(net, startId, endId, segmentIds) {

  // must pick at least one segment
  if (!segmentIds || segmentIds.length === 0) {
    return { valid: false, reason: "empty route" };
  }

  // a segment cannot be used more than once
  const used = new Set();
  for (const id of segmentIds) {
    if (used.has(id)) return { valid: false, reason: "segment reused" };
    used.add(id);
  }

  // find each chosen segment in the network
  const segs = [];
  for (const id of segmentIds) {
    const seg = net.segmentById[id];
    if (!seg) return { valid: false, reason: "unknown segment" };
    segs.push(seg);
  }

  // the route must start at the assigned start station
  let current = startId;
  if (segs[0].a !== current && segs[0].b !== current) {
    return { valid: false, reason: "route does not start at the assigned station" };
  }

  const orderedStations = [current];          // the stations we pass, in order
  let currentLine = null;                     // the line we are travelling on now

  // walk through the segments one by one
  for (const seg of segs) {

    // the segment must touch the station we are standing on
    if (seg.a !== current && seg.b !== current) {
      return { valid: false, reason: "segments not connected" };
    }

    // if this segment is on a different line, we are changing line,
    // which is only allowed at an interchange station
    if (currentLine !== null && seg.lineId !== currentLine) {
      if (!net.interchanges.has(current)) {
        return { valid: false, reason: "line change only allowed at an interchange station" };
      }
    }
    currentLine = seg.lineId;

    // move to the other end of the segment
    current = (seg.a === current) ? seg.b : seg.a;
    orderedStations.push(current);
  }

  // the route must end at the assigned end station
  if (current !== endId) {
    return { valid: false, reason: "route does not end at the assigned station" };
  }

  return { valid: true, orderedStations };
}
