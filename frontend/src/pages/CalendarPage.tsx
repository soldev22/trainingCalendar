import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getToken, parseToken, UserRole } from '../lib/auth'

type EventItem = {
  _id: string
  date: string
  reason: string
  createdBy: string
  status?: 'provisional' | 'confirmed'
  startTime?: string
  endTime?: string
}

function startOfMonth(d: Date) {
  const x = new Date(d)
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfMonth(d: Date) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + 1)
  x.setDate(0)
  x.setHours(23, 59, 59, 999)
  return x
}

function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() // 0=Sun
  x.setDate(x.getDate() - day)
  return x
}

function endOfWeek(d: Date) {
  const x = startOfWeek(d)
  x.setDate(x.getDate() + 6)
  x.setHours(23, 59, 59, 999)
  return x
}

function fmtLocalYMD(d: Date) {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'year'>('month')
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blackouts, setBlackouts] = useState<Array<{ startDate: string; endDate: string; portion: 'full'|'am'|'pm'; reason?: string }>>([])
  const token = getToken()
  const currentUser = useMemo(() => {
    const t = getToken();
    return t ? parseToken(t) : null;
  }, [token]);

  const from = useMemo(() => {
    if (view === 'week') return fmtLocalYMD(startOfWeek(cursor))
    if (view === 'year') {
      const y = cursor.getFullYear()
      return `${y}-01-01`
    }
    return fmtLocalYMD(startOfMonth(cursor))
  }, [cursor, view])
  const to = useMemo(() => {
    if (view === 'week') return fmtLocalYMD(endOfWeek(cursor))
    if (view === 'year') {
      const y = cursor.getFullYear()
      return `${y}-12-31`
    }
    return fmtLocalYMD(endOfMonth(cursor))
  }, [cursor, view])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [resE, resB] = await Promise.all([
          fetch(`/api/events?from=${from}&to=${to}`),
          fetch(`/api/blackouts?from=${from}&to=${to}`),
        ])
        const dataE = await resE.json()
        const dataB = await resB.json()
        if (!resE.ok || !dataE.ok) throw new Error(dataE.error || 'Failed to load events')
        if (!resB.ok || !dataB.ok) throw new Error(dataB.error || 'Failed to load blackouts')
        if (!cancelled) {
          setEvents(dataE.events)
          setBlackouts(dataB.blackouts)
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Unexpected error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [from, to])

  const dayStatus = useMemo(() => {
    // Map ISO date -> { confirmed: boolean, provisional: boolean }
    const map = new Map<string, { confirmed: boolean; provisional: boolean }>()
    for (const e of events) {
      const iso = fmtLocalYMD(new Date(e.date))
      if (!map.has(iso)) map.set(iso, { confirmed: false, provisional: false })
      const bucket = map.get(iso)!
      if (e.status === 'confirmed') bucket.confirmed = true
      else bucket.provisional = true
    }
    return map
  }, [events])

  // Build per-day blackout portion map
  const dayBlackout = useMemo(() => {
    // Map date -> 'none' | 'am' | 'pm' | 'full'
    const map = new Map<string, 'none' | 'am' | 'pm' | 'full'>()
    function apply(dateIso: string, portion: 'full'|'am'|'pm') {
      const cur = map.get(dateIso) || 'none'
      if (portion === 'full' || cur === 'full') {
        map.set(dateIso, 'full')
        return
      }
      if (cur === 'none') {
        map.set(dateIso, portion)
      } else if ((cur === 'am' && portion === 'pm') || (cur === 'pm' && portion === 'am')) {
        map.set(dateIso, 'full')
      } // else keep existing
    }
    for (const b of blackouts) {
      const s = new Date(b.startDate)
      const e = new Date(b.endDate)
      // iterate days from s..e
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        apply(fmtLocalYMD(d), b.portion)
      }
    }
    return map
  }, [blackouts])

  const dayEvents = useMemo(() => {
    // Map ISO date -> EventItem[] sorted by startTime then reason
    const map = new Map<string, EventItem[]>()
    for (const e of events) {
      const iso = fmtLocalYMD(new Date(e.date))
      if (!map.has(iso)) map.set(iso, [])
      map.get(iso)!.push(e)
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => {
        const sa = a.startTime || ''
        const sb = b.startTime || ''
        if (sa !== sb) return sa < sb ? -1 : 1
        return (a.reason || '').localeCompare(b.reason || '')
      })
    }
    return map
  }, [events])

  // Build simple month grid (for Month view)
  const first = startOfMonth(cursor)
  const last = endOfMonth(cursor)
  const daysInMonth = last.getDate()
  const startWeekday = first.getDay() // 0=Sun..6=Sat

  const cells: Date[] = []
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(first)
    d.setDate(d.getDate() - (startWeekday - i))
    cells.push(d)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const x = new Date(first)
    x.setDate(d)
    cells.push(x)
  }
  while (cells.length % 7 !== 0) {
    const lastCell = cells[cells.length - 1]
    const x = new Date(lastCell)
    x.setDate(x.getDate() + 1)
    cells.push(x)
  }

  function prevMonth() {
    const x = new Date(cursor)
    if (view === 'week') x.setDate(x.getDate() - 7)
    else if (view === 'year') x.setFullYear(x.getFullYear() - 1)
    else x.setMonth(x.getMonth() - 1)
    setCursor(x)
  }
  function nextMonth() {
    const x = new Date(cursor)
    if (view === 'week') x.setDate(x.getDate() + 7)
    else if (view === 'year') x.setFullYear(x.getFullYear() + 1)
    else x.setMonth(x.getMonth() + 1)
    setCursor(x)
  }

  const monthLabel = view === 'year'
    ? cursor.getFullYear().toString()
    : view === 'week'
    ? `${fmtLocalYMD(startOfWeek(cursor))} → ${fmtLocalYMD(endOfWeek(cursor))}`
    : cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })

  function gotoMonth(monthIndex: number) {
    const y = cursor.getFullYear()
    const d = new Date(y, monthIndex, 1)
    setCursor(d)
    setView('month')
  }

  function gotoWeek(date: Date) {
    setCursor(new Date(date))
    setView('week')
  }

  // Build week days (for Week view)
  const weekDays: Date[] = useMemo(() => {
    if (view !== 'week') return []
    const s = startOfWeek(cursor)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s)
      d.setDate(s.getDate() + i)
      return d
    })
  }, [cursor, view])

  // Year view aggregation per month
  const monthAgg = useMemo(() => {
    if (view !== 'year') return [] as Array<{ month: number; label: string; count: number; blackout: boolean }>
    const y = cursor.getFullYear()
    const arr: Array<{ month: number; label: string; count: number; blackout: boolean }> = []
    for (let m = 0; m < 12; m++) {
      const label = new Date(y, m, 1).toLocaleString(undefined, { month: 'short' })
      arr.push({ month: m, label, count: 0, blackout: false })
    }
    for (const e of events) {
      const d = new Date(e.date)
      if (d.getFullYear() === y) arr[d.getMonth()].count++
    }
    // Any blackout touching that month sets blackout flag
    for (const b of blackouts) {
      const s = new Date(b.startDate)
      const e = new Date(b.endDate)
      if (s.getFullYear() !== y && e.getFullYear() !== y) continue
      const mStart = s.getFullYear() === y ? s.getMonth() : 0
      const mEnd = e.getFullYear() === y ? e.getMonth() : 11
      for (let m = mStart; m <= mEnd; m++) arr[m].blackout = true
    }
    return arr
  }, [events, blackouts, cursor, view])

  return (
    <div className="container mt-4">
      <h1>Calendar</h1>

      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <button onClick={prevMonth} className="btn btn-outline-secondary" title="Previous">{'<'}</button>
        <strong className="mx-2">{monthLabel}</strong>
        <button onClick={nextMonth} className="btn btn-outline-secondary" title="Next">{'>'}</button>
        <div className="ms-auto btn-group">
          <button onClick={() => setView('week')} disabled={view==='week'} className={`btn ${view==='week' ? 'btn-primary' : 'btn-outline-secondary'}`}>Week</button>
          <button onClick={() => setView('month')} disabled={view==='month'} className={`btn ${view==='month' ? 'btn-primary' : 'btn-outline-secondary'}`}>Month</button>
          <button onClick={() => setView('year')} disabled={view==='year'} className={`btn ${view==='year' ? 'btn-primary' : 'btn-outline-secondary'}`}>Year</button>
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {view === 'month' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((w) => (
            <div key={w} style={{ fontWeight: 600, textAlign: 'center' }}>{w}</div>
          ))}
          {cells.map((d, idx) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const iso = fmtLocalYMD(d);
            const portion = dayBlackout.get(iso) || 'none';
            const tileBg =
              portion === 'full'
                ? '#e5e7eb'
                : portion === 'am'
                ? 'linear-gradient(to bottom, #e5e7eb 50%, #ffffff 50%)'
                : portion === 'pm'
                ? 'linear-gradient(to bottom, #ffffff 50%, #e5e7eb 50%)'
                : 'white';
            return (
              <div
                key={idx}
                title={iso}
                style={{
                  padding: 8,
                  border: '1px solid #eee',
                  background: tileBg,
                  color: inMonth ? '#111' : '#aaa',
                  textAlign: 'right',
                  minHeight: 90,
                }}
              >
                <button onClick={() => gotoWeek(d)} style={{ fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }} title="View week">
                  {d.getDate()}
                </button>
                <div style={{ marginTop: 6, textAlign: 'left', fontSize: 12, color: '#111', maxHeight: 60, overflow: 'hidden' }}>
                  {(dayEvents.get(iso) || []).map((e, i) => {
                    const timeLabel = e.startTime && e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime ? e.startTime : '';
                    const labelBg = e.status === 'confirmed' ? '#fecaca' : '#fef08a';
                    const labelColor = '#111';
                    const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.sub === e.createdBy);
                    const eventEl = (
                      <span style={{
                        display: 'inline-block',
                        background: labelBg,
                        color: labelColor,
                        padding: '2px 6px',
                        borderRadius: 4,
                        maxWidth: '100%',
                      }}>
                        {timeLabel ? `${timeLabel} ` : ''}{e.reason}
                      </span>
                    );
                    return (
                      <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {canEdit ? <Link to={`/events/${e._id}/edit`}>{eventEl}</Link> : eventEl}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'week' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {weekDays.map((d, idx) => {
            const iso = fmtLocalYMD(d);
            const portion = dayBlackout.get(iso) || 'none';
            const tileBg =
              portion === 'full'
                ? '#e5e7eb'
                : portion === 'am'
                ? 'linear-gradient(to bottom, #e5e7eb 50%, #ffffff 50%)'
                : portion === 'pm'
                ? 'linear-gradient(to bottom, #ffffff 50%, #e5e7eb 50%)'
                : 'white';
            return (
              <div key={idx} style={{ padding: 8, border: '1px solid #eee', background: tileBg, minHeight: 120 }}>
                <div style={{ fontWeight: 600 }}>
                  {d.toLocaleDateString(undefined, { weekday: 'short' })} {d.getDate()}
                </div>
                <div style={{ marginTop: 6, textAlign: 'left', fontSize: 12, color: '#111' }}>
                  {(dayEvents.get(iso) || []).map((e, i) => {
                    const timeLabel = e.startTime && e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime ? e.startTime : '';
                    const labelBg = e.status === 'confirmed' ? '#fecaca' : '#fef08a';
                    const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.sub === e.createdBy);
                    const eventEl = (
                      <span style={{ background: labelBg, padding: '2px 6px', borderRadius: 4 }}>
                        {timeLabel ? `${timeLabel} ` : ''}{e.reason}
                      </span>
                    );
                    return (
                      <div key={i} style={{ marginBottom: 4 }}>
                        {canEdit ? <Link to={`/events/${e._id}/edit`}>{eventEl}</Link> : eventEl}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'year' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {monthAgg.map((m, idx) => (
            <div key={idx} style={{ border: '1px solid #eee', padding: 8 }}>
              <button onClick={() => gotoMonth(m.month)} style={{ fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', color: '#111' }} title="View month">
                {m.label}
              </button>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Events: {m.count}
              </div>
              {m.blackout && (
                <div style={{ fontSize: 12, color: '#374151' }}>
                  Blackouts present
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
