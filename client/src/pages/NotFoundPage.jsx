import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <Card className="shadow-sm">
      <Card.Body>
        <Card.Title as="h3">Page not found</Card.Title>
        <Card.Text>
          The page you requested does not exist. <Link to="/">Go home</Link>.
        </Card.Text>
      </Card.Body>
    </Card>
  );
}
