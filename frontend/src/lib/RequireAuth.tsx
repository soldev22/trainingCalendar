import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getUserRole } from './auth'

export default function RequireAuth({ children, adminOnly }: { children: React.ReactElement; adminOnly?: boolean }) {
  const role = getUserRole();

  if (role === 'public') {
    // For now, we'll just redirect to home. In a real app, you might want to show a login modal.
    return <Navigate to="/" replace />;
  }

  if (adminOnly && role !== 'admin') {
    // Redirect non-admins from admin-only pages
    return <Navigate to="/" replace />;
  }

  return children;
}
