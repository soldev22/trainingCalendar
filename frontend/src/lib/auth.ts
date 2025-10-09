import { jwtDecode } from 'jwt-decode';

export type UserRole = 'admin' | 'client' | 'public';

type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
};

export function parseToken(token: string): JwtPayload | null {
  try {
    return jwtDecode<JwtPayload>(token);
  } catch {
    return null;
  }
}

export function getUserRole(): UserRole {
  const token = getToken();
  if (!token) return 'public';
  const payload = parseToken(token);
  return payload?.role || 'public';
}

export function getToken(): string | null {
  try {
    return localStorage.getItem('token')
  } catch {
    return null
  }
}

export function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
