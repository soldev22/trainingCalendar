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
      setTimeout(() => navigate('/calendar'), 800)
    } catch (e: any) {
      setError(e.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
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
    </div>
  )
}
