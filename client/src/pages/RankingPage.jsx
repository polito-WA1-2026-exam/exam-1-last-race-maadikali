import { useEffect, useState } from 'react';
import { Table, Card, Spinner, Alert } from 'react-bootstrap';
import { api } from '../api.js';

export default function RankingPage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);

  // load the ranking when the page opens
  useEffect(() => {
    let cancelled = false;
    api.ranking()
      .then(r => { if (!cancelled) setRows(r); })
      .catch(e => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Card>
      <Card.Body>
        <Card.Title as="h3">General Ranking</Card.Title>
        <p className="text-muted">Best score of each registered user.</p>

        {err && <Alert variant="danger">{err}</Alert>}
        {!rows && !err && <Spinner animation="border" />}

        {rows && (
          <Table hover>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Best score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.username}>
                  <td>{i + 1}</td>
                  <td>{r.username}</td>
                  <td><b>{r.best_score}</b></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3} className="text-muted">No games played yet.</td></tr>
              )}
            </tbody>
          </Table>
        )}
      </Card.Body>
    </Card>
  );
}
