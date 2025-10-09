import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import AuthModal from './AuthModal';
import { getToken, getUserRole } from '../lib/auth';

export default function Header() {
  const token = getToken();
  const navigate = useNavigate();
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const userRole = getUserRole();

  function handleLogout() {
    try {
      localStorage.removeItem('token');
    } catch (error) {
      console.error('Failed to remove token on logout', error);
    }
    navigate('/calendar');
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
