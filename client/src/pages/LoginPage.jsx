import { useState } from 'react';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

// demo accounts shown under the form (click to fill in)
const DEMO = [
  { u: 'Erasyl', p: 'Erasyl2004' },
  { u: 'Azamat', p: 'Azamat2005' },
  { u: 'Ayazhan', p: 'Ayazhan2006' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // already logged in? go straight to the game
  if (user) return <Navigate to="/play" replace />;

  // try to log in when the form is submitted
  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate('/play');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  // fill the form with a demo account
  function fill(d) {
    setUsername(d.u);
    setPassword(d.p);
    setError(null);
  }

  return (
    <section className="d-flex justify-content-center align-items-center" style={{ minHeight: 'calc(100vh - 130px)' }}>
      <Card style={{ maxWidth: 440, width: '100%' }}>
        <Card.Body className="p-4">
          <Card.Title as="h3" className="mb-3">Sign in</Card.Title>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" autoFocus placeholder="Erasyl" required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" placeholder="password" required />
            </Form.Group>
            <Button type="submit" disabled={busy} variant="primary" className="w-100">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </Form>

          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
            <p className="text-muted mb-2">Demo accounts (click to fill):</p>
            <div className="d-flex flex-wrap gap-2">
              {DEMO.map(d => (
                <button key={d.u} type="button" className="lr-seg-chip" style={{ width: 'auto' }} onClick={() => fill(d)}>
                  {d.u} / {d.p}
                </button>
              ))}
            </div>
          </div>
        </Card.Body>
      </Card>
    </section>
  );
}
