import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Alert } from 'react-bootstrap';
import { authHeaders, UserRole } from '../lib/auth';

interface User {
  _id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to update role');
      }
      fetchUsers(); // Refresh the user list
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mt-4">
      <h1>User Administration</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id}>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>{new Date(user.createdAt).toLocaleString()}</td>
              <td>
                {user.role === 'client' ? (
                  <Button variant="success" size="sm" onClick={() => handleRoleChange(user._id, 'admin')}>
                    Make Admin
                  </Button>
                ) : (
                  <Button variant="warning" size="sm" onClick={() => handleRoleChange(user._id, 'client')}>
                    Make Client
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
