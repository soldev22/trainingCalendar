import React, { useState } from 'react';
import { Modal, Button, Form, Alert, Nav } from 'react-bootstrap';

interface AuthModalProps {
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
  initialView?: 'login' | 'register';
}

export default function AuthModal({ show, onHide, onSuccess, initialView = 'login' }: AuthModalProps) {
  const [view, setView] = useState(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const endpoint = view === 'login' ? '/api/auth/login' : '/api/auth/register';
    const action = view === 'login' ? 'Login' : 'Registration';

    if (view === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `${action} failed`);
      }
      localStorage.setItem('token', data.token);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Nav variant="tabs" defaultActiveKey={initialView} onSelect={(k) => setView(k as any)}>
          <Nav.Item>
            <Nav.Link eventKey="login">Login</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="register">Register</Nav.Link>
          </Nav.Item>
        </Nav>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email address</Form.Label>
            <Form.Control
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="password">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Form.Group>

          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? (view === 'login' ? 'Logging in…' : 'Registering…') : (view === 'login' ? 'Login' : 'Register')}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
