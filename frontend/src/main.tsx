import React from 'react'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Link, Navigate, Outlet } from 'react-router-dom'
import DebugDbPage from './pages/DebugDbPage'
import CreateEventPage from './pages/CreateEventPage'
import EventsListPage from './pages/EventsListPage'
import CalendarPage from './pages/CalendarPage'
import EditEventPage from './pages/EditEventPage'
import BlackOutPage from './pages/BlackOutPage'
import AdminPage from './pages/AdminPage'
import AdminEventsPage from './pages/AdminEventsPage'
import { getToken } from './lib/auth'
import RequireAuth from './lib/RequireAuth'
import Header from './components/Header'

function UserDashboard() {
  const token = getToken()
  return (
    <div style={{ padding: 16 }}>
      <h1>Welcome to your Diary</h1>
      <p>Create a new entry or view your existing ones using the links in the header.</p>
    </div>
  )
}

function HomePage() {
  const token = getToken()
  return token ? <UserDashboard /> : <Navigate to="/calendar" replace />
}

function RootLayout() {
  return (
    <div>
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      // Public
      { path: 'calendar', element: <CalendarPage /> },
            // Protected
      { path: 'debug/db', element: (<RequireAuth><DebugDbPage /></RequireAuth>) },
      { path: 'events/new', element: (<RequireAuth><CreateEventPage /></RequireAuth>) },
      { path: 'events', element: (<RequireAuth><EventsListPage /></RequireAuth>) },
      { path: 'events/:id/edit', element: (<RequireAuth><EditEventPage /></RequireAuth>) },
      { path: 'blackout', element: (<RequireAuth adminOnly={true}><BlackOutPage /></RequireAuth>) },
      { path: 'admin', element: (<RequireAuth adminOnly={true}><AdminPage /></RequireAuth>) },
      { path: 'admin/events', element: (<RequireAuth adminOnly={true}><AdminEventsPage /></RequireAuth>) },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
