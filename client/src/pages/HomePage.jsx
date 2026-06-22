import { useEffect, useState } from 'react';
import { Button, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api.js';
import MetroMap from '../components/MetroMap.jsx';

export default function HomePage() {
  const { user } = useAuth();
  const [net, setNet] = useState(null);

  // load the network map, but only when the user is logged in
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.networkFull()
      .then(n => { if (!cancelled) setNet(n); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // anonymous visitors: just show the instructions and a sign-in button (no map)
  if (!user) {
    return (
      <div className="mx-auto py-4" style={{ maxWidth: 720 }}>
        <h1 className="lr-hero-title mb-3">Last Race</h1>
        <p className="text-muted mb-4">Astana Metro</p>

        <h2 className="h5 mb-2">How to play</h2>
        <ol className="lr-instructions mb-4">
          <li><b>Setup</b> — study the metro map with all its lines.</li>
          <li><b>Planning</b> — the lines disappear. In 90 seconds, build a route from your start to your end station by picking segments. Each segment once.</li>
          <li><b>Execution</b> — the game checks your route. Each step gives a random event that adds or removes coins (you start with 20).</li>
          <li><b>Result</b> — the coins you have left are your score.</li>
        </ol>

        <Button as={Link} to="/login" variant="primary" size="lg">Sign in to play</Button>
      </div>
    );
  }

  // logged-in home: welcome message + buttons on the left, map on the right
  return (
    <div className="d-flex align-items-center" style={{ minHeight: '70vh' }}>
      <Row className="align-items-center g-5 w-100">
        <Col md={6}>
          <h1 className="lr-hero-title mb-4">Welcome back, {user.username}</h1>
          <div className="d-flex flex-wrap gap-2">
            <Button as={Link} to="/play" variant="primary" size="lg">Start a new game</Button>
            <Button as={Link} to="/ranking" variant="outline-secondary" size="lg">View ranking</Button>
          </div>
        </Col>
        <Col md={6}>
          {net ? <MetroMap network={net} showLines={true} /> : null}
        </Col>
      </Row>
    </div>
  );
}
