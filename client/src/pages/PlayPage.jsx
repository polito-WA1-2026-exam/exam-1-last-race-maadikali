import { useEffect, useState } from 'react';
import { Card, Button, Row, Col, Alert, Spinner, Badge, ProgressBar } from 'react-bootstrap';
import { api } from '../api.js';
import MetroMap from '../components/MetroMap.jsx';

// timing values used on this page (all in milliseconds, except where noted)
const TIMER_TICK_MS = 250;        // how often the countdown updates
const STEP_REVEAL_MS = 1200;      // delay between showing each execution step
const RESULT_DELAY_MS = 1500;     // wait after the last step before the result screen
const INVALID_DELAY_MS = 600;     // short wait before showing the result of an invalid route
const PLANNING_SECONDS = 90;      // length of the planning phase (seconds)
const LOW_TIME_SECONDS = 15;      // show the timer in red when fewer seconds remain

export default function PlayPage() {
  // which phase of the game in
  const [phase, setPhase] = useState('setup'); // setup | planning | execution | result
  const [networkFull, setNetworkFull] = useState(null);   // full map (Setup)
  const [networkSegs, setNetworkSegs] = useState(null);   // segments only (Planning)
  const [game, setGame] = useState(null);            // {gameId, startStation, endStation, deadlineMs}
  const [selectedSegs, setSelectedSegs] = useState([]); // the route the player is building (ordered segment IDs)
  const [remaining, setRemaining] = useState(PLANNING_SECONDS);    // seconds left on the countdown
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);        // server response from submit
  const [error, setError] = useState(null);

  // the number of execution steps 
  const [revealedSteps, setRevealedSteps] = useState(0);

  // load the full network once when the page mounts
  useEffect(() => {
    let cancelled = false;
    setError(null);
    api.networkFull()
      .then(n => { if (!cancelled) setNetworkFull(n); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };   
  }, []);

  // recompute "seconds left" from the server deadline every 250ms
  useEffect(() => {
    if (phase !== 'planning' || !game) return;
    function tick() {
      const remMs = Math.max(0, game.deadlineMs - Date.now());   // deadline minus now
      setRemaining(Math.ceil(remMs / 1000));
    }
    tick();
    const id = setInterval(tick, TIMER_TICK_MS);
    return () => clearInterval(id);   // stop the timer
  }, [phase, game]);

  // when the timer reaches 0, auto-submit the route built so far
  useEffect(() => {
    if (phase === 'planning' && game && remaining <= 0 && !submitting) {
      handleSubmit();
    }
  }, [remaining, phase]);

  //  reveal the steps one at a time
  useEffect(() => {
    if (phase !== 'execution' || !result?.valid) return;
    setRevealedSteps(0);
    const id = setInterval(() => {
      setRevealedSteps(prev => {
        if (prev >= result.steps.length) {
          clearInterval(id);
          return prev;
        }
        return prev + 1;
      });
    }, STEP_REVEAL_MS);
    return () => clearInterval(id);
  }, [phase, result]);

  // once all steps are shown (or route was invalid), move to the result screen
  useEffect(() => {
    if (phase !== 'execution' || !result) return;
    if (!result.valid) {
      const t = setTimeout(() => setPhase('result'), INVALID_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (revealedSteps >= result.steps.length && result.steps.length > 0) {
      const t = setTimeout(() => setPhase('result'), RESULT_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [revealedSteps, result, phase]);

  // Setup "Start": fetch the segments and create a new game, then go to planning
  async function startPlanning() {
    setError(null);
    try {
      const segs = await api.networkSegments();
      const g = await api.newGame();
      setNetworkSegs(segs);
      setGame(g);
      setSelectedSegs([]);
      setRemaining(g.planningSeconds);
      setPhase('planning');
    } catch (e) {
      setError(e.message);
    }
  }

  // send the chosen route to the server
  async function handleSubmit() {
    if (!game || submitting) return;   // don't submit twice
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.submitGame(game.gameId, selectedSegs);   // server checks the route and runs the events
      setResult(r);
      setPhase('execution');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // reset everything back to a fresh setup phase
  function restart() {
    setPhase('setup');
    setGame(null);
    setNetworkSegs(null);
    setSelectedSegs([]);
    setResult(null);
    setRevealedSteps(0);
    setRemaining(PLANNING_SECONDS);
    setError(null);
  }

  // find a station's name from its id (the segment list only has ids)
  function stationName(id) {
    const list = networkSegs ? networkSegs.stations : (networkFull ? networkFull.stations : []);
    const found = list.find(s => s.id === id);
    return found ? found.name : '#' + id;
  }

  // show any error
  if (error) {
    return (
      <Alert variant="danger">
        {error} <Button size="sm" variant="link" onClick={() => setError(null)}>dismiss</Button>
      </Alert>
    );
  }

  //  Setup screen: full map + Start button
  if (phase === 'setup') {
    if (!networkFull) return <Centered><Spinner animation="border" variant="light" /></Centered>;
    return (
      <div className="d-grid gap-3 py-2">
        <Card>
          <Card.Body className="d-flex flex-wrap justify-content-between align-items-center gap-3 p-4">
            <div>
              <p className="lr-phase">Phase 1 · Setup</p>
              <h2 className="mt-1 mb-1 h4">Study the network</h2>
              <p className="text-muted mb-0">
                The four dark dots are interchanges where you can switch lines.
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={startPlanning}>Start</Button>
          </Card.Body>
        </Card>
        <MetroMap network={networkFull} showLines={true} />
      </div>
    );
  }

  // Planning screen, stations-only map + segment list + countdown
  if (phase === 'planning') {
    if (!networkSegs || !game) return <Centered><Spinner animation="border" variant="light" /></Centered>;
    const pct = Math.round((remaining / game.planningSeconds) * 100);
    const lowTime = remaining < LOW_TIME_SECONDS;   // turn the timer red near the end
    return (
      <div className="d-grid gap-3 py-2">
        <Card>
          <Card.Body className="p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div className="d-grid gap-2">
                <p className="lr-phase">Phase 2 · Planning</p>
                <div className="d-flex flex-wrap gap-2">
                  {/* assigned start and end stations */}
                  <span className="lr-chip start"><span className="dot" />Start · {game.startStation.name}</span>
                  <span className="lr-chip end"><span className="dot" />End · {game.endStation.name}</span>
                </div>
              </div>
              <div className="d-flex align-items-center gap-3">
                <div className={`lr-timer ${lowTime ? 'low' : ''}`}>{remaining}</div>
                <Button variant="success" size="lg" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit route'}
                </Button>
              </div>
            </div>
            <ProgressBar className="mt-4" now={pct} variant={lowTime ? 'danger' : undefined} />
          </Card.Body>
        </Card>

        <Row className="g-3">
          <Col lg={8}>
            <div className="d-grid gap-3">
              {/* planning map: lines + interchanges stripped out, only stations + start/end shown */}
              <MetroMap network={{ ...networkSegs, lines: [], interchanges: [] }} showLines={false}
                highlightStart={game.startStation.id} highlightEnd={game.endStation.id} compact />

              <Card>
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <p className="lr-phase mb-0">Your route · {selectedSegs.length} segment{selectedSegs.length === 1 ? '' : 's'}</p>
                    {selectedSegs.length > 0 && (
                      <div className="d-flex gap-2">
                        {/* undo last segment / clear the whole route */}
                        <Button variant="outline-secondary" size="sm" onClick={() => setSelectedSegs(s => s.slice(0, -1))}>Undo last</Button>
                        <Button variant="outline-danger" size="sm" onClick={() => setSelectedSegs([])}>Clear</Button>
                      </div>
                    )}
                  </div>
                  {selectedSegs.length === 0 ? (
                    <p className="text-muted mb-0">
                      Pick segments to build your route from <b style={{ color: '#a7f3d0' }}>{game.startStation.name}</b> to <b style={{ color: '#fecdd3' }}>{game.endStation.name}</b>, in travel order.
                    </p>
                  ) : (
                    // show the route so far as ordered pills
                    <div className="d-flex flex-wrap align-items-center gap-1">
                      {selectedSegs.map((segId, i) => {
                        const [a, b] = segId.split('-').map(Number);   // segment id is "a-b"
                        return (
                          <span key={`${segId}-${i}`} className="d-inline-flex align-items-center gap-1">
                            <span className="lr-route-pill">{stationName(a)} — {stationName(b)}</span>
                            {i < selectedSegs.length - 1 && <span className="text-muted">→</span>}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </div>
          </Col>

          <Col lg={4}>
            <Card style={{ position: 'sticky', top: '1rem' }}>
              <Card.Body className="p-3">
                {/* the full list of segments; clicking one adds it to the route */}
                <div className="lr-seg-grid single" style={{ maxHeight: '64vh', overflowY: 'auto', paddingRight: 4 }}>
                  {networkSegs.segments.map(seg => {
                    const used = selectedSegs.includes(seg.id);   // already picked, so disable it
                    return (
                      <button key={seg.id} type="button" className="lr-seg-chip" disabled={used}
                        onClick={() => !used && setSelectedSegs(s => [...s, seg.id])}>
                        <span>{stationName(seg.a)} — {stationName(seg.b)}</span>
                      </button>
                    );
                  })}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  // Execution screen: reveal each step + running coin total
  if (phase === 'execution') {
    if (!result) return <Centered><Spinner animation="border" variant="light" /></Centered>;
    // invalid route so no execution, coins lost
    if (!result.valid) {
      return (
        <Card className="mt-3" style={{ borderColor: 'rgba(251,113,133,0.35)' }}>
          <Card.Body className="p-4">
            <h2 className="h4" style={{ color: '#fda4af' }}>Invalid route</h2>
            <p className="text-muted mb-0">Reason: {result.reason}. You lose all your coins.</p>
          </Card.Body>
        </Card>
      );
    }
    const shown = result.steps.slice(0, revealedSteps);   // only the revealed steps
    const last = shown[shown.length - 1];
    const coins = last ? last.coinsAfter : result.initialCoins;   // current coin total
    return (
      <div className="py-2">
        <Card>
          <Card.Body className="p-4">
            <div className="d-flex justify-content-between align-items-center gap-3">
              <div>
                <p className="lr-phase">Phase 3 · Execution</p>
                <h2 className="mt-1 mb-0 h4">Riding your route…</h2>
              </div>
              <div className="lr-coin-box">
                <div className="k">Coins</div>
                <div className="v">{coins}</div>
              </div>
            </div>
            <div className="mt-4">
              {/* one card per revealed step, the event and the new coin total */}
              {shown.map(s => (
                <Card key={s.step} body className={`event-card ${
                  s.event.effect > 0 ? 'positive' : s.event.effect < 0 ? 'negative' : 'neutral'
                }`}>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <p className="lr-phase mb-1">Step {s.step}</p>
                      <p className="mb-1"><b>{s.from.name}</b> <span className="text-muted">→</span> <b>{s.to.name}</b></p>
                      <p className="text-muted small mb-0">{s.event.description}</p>
                    </div>
                    <div className="text-end">
                      <Badge bg={s.event.effect > 0 ? 'success' : s.event.effect < 0 ? 'danger' : 'secondary'}
                        style={{ fontSize: '0.9rem', borderRadius: '999px', padding: '0.35rem 0.7rem' }}>
                        {s.event.effect >= 0 ? `+${s.event.effect}` : s.event.effect}
                      </Badge>
                      <div className="text-muted small mt-1">→ {s.coinsAfter} coins</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card.Body>
        </Card>
      </div>
    );
  }

  // Result screen: final score + play again 
  return (
    <div className="py-4">
      <Card className="mx-auto" style={{ maxWidth: 560 }}>
        <Card.Body className="text-center p-5">
          <p className="lr-phase">Final score</p>
          <div className="my-3">
            <span className="lr-score-big">{result?.score ?? 0}</span>
            <span className="h3 text-muted ms-2">coins</span>
          </div>
          {result?.valid
            ? <p className="text-muted">You completed the route. Well done!</p>
            : <p style={{ color: '#fda4af' }}>{result?.reason ?? 'Route was not valid.'}</p>}
          <Button variant="primary" size="lg" className="mt-2" onClick={restart}>Play again</Button>
        </Card.Body>
      </Card>
    </div>
  );
}

// small centered wrapper for spinners
function Centered({ children }) {
  return <div className="d-flex justify-content-center py-5">{children}</div>;
}