import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

// top navigation bar
export default function NavHeader() {
  // get the logged-in user (or null) and the logout function
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // log out, then go to the home page
  async function handleLogout() {
    navigate('/');
    await logout();
  }

  return (
    <Navbar expand="md" sticky="top" className="px-3">
      <Container fluid>
        {/* plain text logo */}
        <Navbar.Brand as={Link} to="/">
          <span className="lr-wordmark">Last Race</span>
        </Navbar.Brand>

        <Nav className="me-auto">
          <Nav.Link as={NavLink} to="/" end>Home</Nav.Link>
          {/* these links only show when logged in */}
          {user && <Nav.Link as={NavLink} to="/play">Play</Nav.Link>}
          {user && <Nav.Link as={NavLink} to="/ranking">Ranking</Nav.Link>}
        </Nav>

        <Nav className="align-items-center">
          {user && (
            <>
              <span className="text-muted me-3">Hi {user.username}</span>
              <Button size="sm" variant="outline-secondary" onClick={handleLogout}>Logout</Button>
            </>
          )}
        </Nav>
      </Container>
    </Navbar>
  );
}
