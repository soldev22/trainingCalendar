import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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

interface EventListProps {
  events: EventItem[];
  onDelete: (eventId: string) => Promise<void>;
}

export default function EventList({ events, onDelete }: EventListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleDelete(eventId: string) {
    try {
      setDeletingId(eventId);
      await onDelete(eventId);
    } catch (err) {
      alert((err as any).message || 'Delete failed');
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <ul className="list-group">
      {events.map((e) => {
        const badgeVariant = e.status === 'confirmed' ? 'danger' : 'warning';
        const label = e.status === 'confirmed' ? 'Confirmed' : 'Provisional';
        const timeLabel = e.startTime && e.endTime
          ? ` (${e.startTime}–${e.endTime})`
          : e.startTime
          ? ` (${e.startTime})`
          : '';
        return (
          <li key={e._id} className="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <span className={`badge bg-${badgeVariant} me-2`}>{label}</span>
              <strong>{new Date(e.date).toLocaleDateString()}</strong>{timeLabel} — {e.reason}
              {e.notes && <div className="text-muted small mt-1">{e.notes}</div>}
            </div>
            <div>
              <Link to={`/events/${e._id}/edit`} className="btn btn-sm btn-outline-primary me-2">Edit</Link>
              {confirmId === e._id ? (
                <span className="d-inline-flex align-items-center gap-2">
                  <span>Confirm delete?</span>
                  <button
                    onClick={() => handleDelete(e._id)}
                    disabled={deletingId === e._id}
                    className="btn btn-sm btn-danger"
                  >
                    {deletingId === e._id ? 'Deleting…' : 'Yes'}
                  </button>
                  <button onClick={() => setConfirmId(null)} className="btn btn-sm btn-secondary">No</button>
                </span>
              ) : (
                <button onClick={() => setConfirmId(e._id)} className="btn btn-sm btn-outline-danger">Delete</button>
              )}
            </div>
          </li>
        );
      })}
      {events.length === 0 && <li className="list-group-item">No events yet.</li>}
    </ul>
  );
}
