import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authHeaders, parseToken, getToken } from '../lib/auth'

const presetReasons = ['Training', 'Meeting'] as const

type PresetReason = typeof presetReasons[number]

export default function CreateEventPage() {
  const [date, setDate] = useState<string>('')
  const [preset, setPreset] = useState<PresetReason>('Meeting')
  const [customReason, setCustomReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [status, setStatus] = useState<'provisional' | 'confirmed'>('provisional')
  const [startTime, setStartTime] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const navigate = useNavigate()

  // Pre-fill notes with user's email
  useState(() => {
    const token = getToken();
    if (token) {
      const payload = parseToken(token);
      if (payload) {
        setNotes(`Booked by: ${payload.email}`)
      }
    }
  })

  const reason = preset

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!date) {
      setError('Please choose a date')
      return
    }
    if (!reason || reason.trim().length === 0) {
      setError('Please provide a reason')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ date, reason, notes, status, startTime: startTime || undefined, endTime: endTime || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to create event')
      }
      setSuccess('Event created successfully')
      // Small delay then navigate home
      setTimeout(() => navigate('/'), 800)
    } catch (err: any) {
      setError(err.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mt-4">
      <h1>Create Diary Event</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="date" className="form-label">Date</label>
          <input
            id="date"
            className="form-control"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label htmlFor="reason" className="form-label">Reason</label>
          <select
            id="reason"
            className="form-select"
            value={preset}
            onChange={(e) => setPreset(e.target.value as PresetReason)}
          >
            {presetReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label htmlFor="notes" className="form-label">Notes</label>
          <textarea
            id="notes"
            className="form-control"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
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

        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? 'Saving…' : 'Save Event'}
        </button>

        {error && (
          <div className="alert alert-danger mt-3">{error}</div>
        )}
        {success && (
          <div className="alert alert-success mt-3">{success}</div>
        )}
      </form>
    </div>
  )
}
