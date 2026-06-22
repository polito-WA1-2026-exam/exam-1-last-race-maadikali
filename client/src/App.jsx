import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import NavHeader from './components/NavHeader.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import PlayPage from './pages/PlayPage.jsx';
import RankingPage from './pages/RankingPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import { Container, Spinner } from 'react-bootstrap';

// only renders children if logged in
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <CenterSpinner />;          // wait while the session is being checked
  if (!user) return <Navigate to="/login" replace />;  // not logged in then redirect to login
  return children;
}

// small centered loading spinner
function CenterSpinner() {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
      <Spinner animation="border" />
    </div>
  );
}

export default function App() {
  return (
    // AuthProvider makes the logged-in user available to the whole app
    <AuthProvider>
      <NavHeader />
      <Container className="py-4">
        {/* all the app routes */}
        <Routes>
          <Route path="/" element={<HomePage />} />              {/* public home / instructions */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/play" element={<RequireAuth><PlayPage /></RequireAuth>} />        {/* protected */}
          <Route path="/ranking" element={<RequireAuth><RankingPage /></RequireAuth>} />  {/* protected */}
          <Route path="*" element={<NotFoundPage />} />          {/* anything else */}
        </Routes>
      </Container>
    </AuthProvider>
  );
}