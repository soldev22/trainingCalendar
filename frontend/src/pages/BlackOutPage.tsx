import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authHeaders } from '../lib/auth'

export default function BlackOutPage() {
  const navigate = useNavigate()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [portion, setPortion] = useState<'full' | 'am' | 'pm'>('full')
  const [reason, setReason] = useState('Blackout')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Manage UI state
  const todayIso = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(); monthStart.setDate(1)
  const monthEnd = new Date(monthStart); monthEnd.setMonth(monthEnd.getMonth() + 1); monthEnd.setDate(0)
  const [listFrom, setListFrom] = useState(monthStart.toISOString().slice(0,10))
  const [listTo, setListTo] = useState(monthEnd.toISOString().slice(0,10))
  const [loadingList, setLoadingList] = useState(false)
  const [listErr, setListErr] = useState<string | null>(null)
  const [items, setItems] = useState<Array<{ _id: string; startDate: string; endDate: string; portion: 'full'|'am'|'pm'; reason?: string }>>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState<{ startDate: string; endDate: string; portion: 'full'|'am'|'pm'; reason: string }>({ startDate: todayIso, endDate: todayIso, portion: 'full', reason: 'Blackout' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (!start || !end) {
        setError('Please select a start and end date')
        return
      }
      setSubmitting(true)
      const res = await fetch('/api/blackouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ startDate: start, endDate: end, portion, reason }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to create blackout')
      setSuccess('Blackout created')
      // reload list if it intersects current range
      void loadList()
      setTimeout(() => navigate('/calendar'), 800)
    } catch (e: any) {
      setError(e.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  async function loadList() {
    try {
      setLoadingList(true)
      setListErr(null)
      const res = await fetch(`/api/blackouts?from=${listFrom}&to=${listTo}`, { headers: { ...authHeaders() } })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load blackouts')
      // Normalize dates to YYYY-MM-DD
      const mapped = data.blackouts.map((b: any) => ({
        _id: b._id,
        startDate: new Date(b.startDate).toISOString().slice(0,10),
        endDate: new Date(b.endDate).toISOString().slice(0,10),
        portion: b.portion as 'full'|'am'|'pm',
        reason: b.reason || 'Blackout',
      }))
      setItems(mapped)
    } catch (e: any) {
      setListErr(e.message || 'Unexpected error')
    } finally {
      setLoadingList(false)
    }
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/blackouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(edit),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update blackout')
      setEditingId(null)
      void loadList()
    } catch (e: any) {
      alert(e.message || 'Unexpected error')
    }
  }

  return (
    <div className="container mt-4">
      <h1>Black Out Days</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="start" className="form-label">Start date</label>
          <input id="start" className="form-control" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="mb-3">
          <label htmlFor="end" className="form-label">End date</label>
          <input id="end" className="form-control" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="mb-3">
          <label htmlFor="portion" className="form-label">Portion</label>
          <select id="portion" className="form-select" value={portion} onChange={(e) => setPortion(e.target.value as 'full' | 'am' | 'pm')}>
            <option value="full">Full day(s)</option>
            <option value="am">Morning only</option>
            <option value="pm">Afternoon only</option>
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="reason" className="form-label">Reason</label>
          <input id="reason" className="form-control" type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Saving…' : 'Create blackout'}</button>
        {error && <div className="alert alert-danger mt-3">{error}</div>}
        {success && <div className="alert alert-success mt-3">{success}</div>}
      </form>

      <hr className="my-4" />
      <div className="d-flex align-items-end gap-2 mb-2">
        <div>
          <label className="form-label">From</label>
          <input type="date" className="form-control" value={listFrom} onChange={(e) => setListFrom(e.target.value)} />
        </div>
        <div>
          <label className="form-label">To</label>
          <input type="date" className="form-control" value={listTo} onChange={(e) => setListTo(e.target.value)} />
        </div>
        <button className="btn btn-outline-secondary" onClick={() => void loadList()}>Load</button>
      </div>
      {loadingList && <div>Loading…</div>}
      {listErr && <div className="alert alert-danger">{listErr}</div>}
      {!loadingList && items.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Start</th>
                <th>End</th>
                <th>Portion</th>
                <th>Reason</th>
                <th style={{width: 180}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it._id}>
                  <td>
                    {editingId === it._id ? (
                      <input type="date" className="form-control form-control-sm" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} />
                    ) : (
                      <span>{it.startDate}</span>
                    )}
                  </td>
                  <td>
                    {editingId === it._id ? (
                      <input type="date" className="form-control form-control-sm" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} />
                    ) : (
                      <span>{it.endDate}</span>
                    )}
                  </td>
                  <td>
                    {editingId === it._id ? (
                      <select className="form-select form-select-sm" value={edit.portion} onChange={(e) => setEdit({ ...edit, portion: e.target.value as 'full'|'am'|'pm' })}>
                        <option value="full">Full</option>
                        <option value="am">AM</option>
                        <option value="pm">PM</option>
                      </select>
                    ) : (
                      <span>{it.portion.toUpperCase()}</span>
                    )}
                  </td>
                  <td>
                    {editingId === it._id ? (
                      <input className="form-control form-control-sm" value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} />
                    ) : (
                      <span>{it.reason}</span>
                    )}
                  </td>
                  <td>
                    {editingId === it._id ? (
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-primary" onClick={() => void saveEdit(it._id)}>Save</button>
                        <button className="btn btn-outline-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={() => { setEditingId(it._id); setEdit({ startDate: it.startDate, endDate: it.endDate, portion: it.portion, reason: it.reason || 'Blackout' }) }}>Edit</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
