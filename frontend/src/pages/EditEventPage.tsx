import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authHeaders, getUserRole } from '../lib/auth';

type EventItem = {
  _id: string;
  date: string;
  reason: string;
  notes?: string;
  status?: 'provisional' | 'confirmed';
  startTime?: string;
  endTime?: string;
};

function toISODateInput(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userRole = getUserRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [date, setDate] = useState<string>('');
  const [reason, setReason] = useState<string>('Meeting');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<'provisional' | 'confirmed'>('provisional');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/events/${id}`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load event');
        const e: EventItem = data.event;
        if (!cancelled) {
          setDate(toISODateInput(e.date));
          setReason(e.reason || 'Meeting');
          setNotes(e.notes || '');
          setStatus((e.status as any) || 'provisional');
          setStartTime(e.startTime || '');
          setEndTime(e.endTime || '');
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Unexpected error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true };
  }, [id]);

  const returnUrl = userRole === 'admin' ? '/admin/events' : '/events';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ date, reason, notes, status, startTime: startTime || undefined, endTime: endTime || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to save changes');
      navigate(returnUrl);
    } catch (e: any) {
      setError(e.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="p-4">Loading…</div>
  );

  return (
    <div className="container mt-4">
      <h1>Edit Event</h1>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="date" className="form-label">Date</label>
          <input id="date" className="form-control" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="mb-3">
          <label htmlFor="reason" className="form-label">Reason</label>
          <select id="reason" className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="Training">Training</option>
            <option value="Meeting">Meeting</option>
          </select>
        </div>

        <div className="mb-3">
          <label htmlFor="notes" className="form-label">Notes</label>
          <textarea id="notes" className="form-control" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="mb-3">
          <label htmlFor="status" className="form-label">Status</label>
          <select id="status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value as 'provisional' | 'confirmed')}>
            <option value="provisional">Provisional</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>

        <fieldset className="mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <legend className="form-label mb-0">Optional time slot</legend>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setStartTime('09:00'); setEndTime('17:00'); }}>
              All Day (9am-5pm)
            </button>
          </div>
          <div className="d-flex gap-3">
            <div className="flex-grow-1">
              <label htmlFor="startTime" className="form-label">Start time</label>
              <input id="startTime" className="form-control" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="flex-grow-1">
              <label htmlFor="endTime" className="form-label">End time</label>
              <input id="endTime" className="form-control" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <small className="form-text text-muted">Leave blank if not needed.</small>
        </fieldset>

        <div className="d-flex gap-2">
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
          <button type="button" onClick={() => navigate(returnUrl)} className="btn btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={async () => {
              if (!id) return;
              if (!confirm('Delete this event?')) return;
              try {
                setDeleting(true);
                const res = await fetch(`/api/events/${id}`, { method: 'DELETE', headers: { ...authHeaders() } });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || data.ok === false) throw new Error(data.error || 'Failed to delete');
                navigate(returnUrl);
              } catch (e: any) {
                alert(e.message || 'Delete failed');
              } finally {
                setDeleting(false);
              }
            }}
            disabled={deleting}
            className="btn btn-danger ms-auto"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </form>
    </div>
  );
}
