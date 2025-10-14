import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import AuthModal from './AuthModal';
import { getToken, getUserRole } from '../lib/auth';

export default function Header() {
  const token = getToken();
  const navigate = useNavigate();
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const [msLoading, setMsLoading] = useState(false);
  const [msResult, setMsResult] = useState<{ label: string; color: string } | null>(null);
  const userRole = getUserRole();

  function handleLogout() {
    try {
      localStorage.removeItem('token');
    } catch (error) {
      console.error('Failed to remove token on logout', error);
    }
    navigate('/calendar');
  }

  async function handleCheckMicrosoft() {
    try {
      setMsLoading(true);
      setMsResult(null);
      const res = await fetch('/api/calendar/health');
      const data = await res.json();
      const status: string = (data?.status || '').toUpperCase();
      let color = 'secondary';
      let label = status || 'UNKNOWN';
      if (status === 'UP') color = 'success';
      else if (status === 'THROTTLED') color = 'warning';
      else if (status === 'DEGRADED') color = 'warning';
      else if (status === 'DOWN') color = 'danger';
      else if (status === 'NOT_CONFIGURED') color = 'secondary';
      setMsResult({ label, color });
    } catch {
      setMsResult({ label: 'DOWN', color: 'danger' });
    } finally {
      setMsLoading(false);
    }
  }

  return (
    <>
      <Navbar bg="primary" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">
            <img
              alt="Diary App Logo"
              src="/logo.svg"
              width="30"
              height="30"
              className="d-inline-block align-top me-2"
            />
            Diary App
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto">
              {!token ? (
                <div className="d-flex align-items-center">
                  <Nav.Link onClick={() => setAuthModal('login')} style={{ color: 'white', textDecoration: 'underline' }}>
                    Login
                  </Nav.Link>
                  <span className="text-white mx-1">/</span>
                  <Nav.Link onClick={() => setAuthModal('register')} style={{ color: 'white', textDecoration: 'underline' }}>
                    Register
                  </Nav.Link>
                </div>
              ) : (
                <>
                  <Navbar.Text className="me-3" style={{ color: 'white' }}>
                    Your Actions:
                  </Navbar.Text>
                  <Nav.Link as={Link} to="/calendar" style={{ color: 'white' }}>
                    Calendar
                  </Nav.Link>
                  <Nav.Link as={Link} to="/events/new" style={{ color: 'white' }}>
                    Create Event
                  </Nav.Link>
                  <Nav.Link as={Link} to={userRole === 'admin' ? '/admin/events' : '/events'} style={{ color: 'white' }}>
                    View Events
                  </Nav.Link>
                  <div className="d-flex align-items-center ms-2">
                    <button
                      onClick={handleCheckMicrosoft}
                      className="btn btn-sm btn-outline-light"
                      disabled={msLoading}
                    >
                      {msLoading ? 'Checking…' : 'Check Microsoft Calendar'}
                    </button>
                    {msResult && (
                      <span className={`badge bg-${msResult.color} ms-2`}>{msResult.label}</span>
                    )}
                  </div>
                  {userRole === 'admin' && (
                    <>
                      <Nav.Link as={Link} to="/blackout" style={{ color: 'white' }}>
                        Black Out Days
                      </Nav.Link>
                      <Nav.Link as={Link} to="/admin" style={{ color: 'white' }}>
                        User Admin
                      </Nav.Link>
                    </>
                  )}
                  <Nav.Link onClick={handleLogout} className="ms-3" style={{ color: 'white' }}>
                    Logout
                  </Nav.Link>
                </>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <AuthModal
        show={!!authModal}
        onHide={() => setAuthModal(null)}
        onSuccess={() => {
          setAuthModal(null);
          location.reload();
        }}
        initialView={authModal || 'login'}
      />
    </>
  );
}
