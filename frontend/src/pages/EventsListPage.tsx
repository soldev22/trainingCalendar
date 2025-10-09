import React, { useCallback, useEffect, useState } from 'react';
import EventList from '../components/EventList';
import { authHeaders } from '../lib/auth';

interface EventItem {
  _id: string;
  date: string;
  reason: string;
  notes?: string;
  status?: 'provisional' | 'confirmed';
  startTime?: string;
  endTime?: string;
}

export default function EventsListPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/events/my-events', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch events');
      }
      setEvents(data.events);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  async function handleDelete(eventId: string) {
    const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'Failed to delete');
    }
    await fetchEvents();
    setNotice('Event deleted');
    setTimeout(() => setNotice(null), 2000);
  }

  return (
    <div className="container mt-4">
      <h1>My Events</h1>
      {notice && <div className="alert alert-success">{notice}</div>}
      {loading && <div>Loading…</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!loading && !error && (
        <EventList events={events} onDelete={handleDelete} />
      )}
    </div>
  );
}
