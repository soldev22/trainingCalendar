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
  source?: 'local' | 'microsoft' | 'blackout'
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
  const [msEvents, setMsEvents] = useState<any[]>([]) // State for Microsoft events
  const [msWarning, setMsWarning] = useState<string | null>(null)
  const [t2Events, setT2Events] = useState<any[]>([])
  const [t2Warning, setT2Warning] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
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
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [resE, resB, resMs, resT2] = await Promise.all([
          fetch(`/api/events?from=${from}&to=${to}`),
          fetch(`/api/blackouts?from=${from}&to=${to}`),
          fetch(`/api/calendar/events?from=${from}&to=${to}`),
          fetch(`/api/calendar/tenant2?from=${from}&to=${to}`),
        ]);

        // Parse all responses before mutating state to minimize flicker
        if (!resE.ok) throw new Error((await resE.json()).error || 'Failed to load events');
        if (!resB.ok) throw new Error((await resB.json()).error || 'Failed to load blackouts');

        const dataE = await resE.json();
        const dataB = await resB.json();

        let msData: any[] = [];
        let msWarn: string | null = null;
        if (resMs.ok) {
          msData = await resMs.json();
        } else {
          const errorData = await resMs.json().catch(() => ({} as any));
          msWarn = errorData?.error || 'The Microsoft Calendar service is temporarily unavailable. Showing local and blackout events only.';
        }

        let t2Data: any[] = [];
        let t2Warn: string | null = null;
        if (resT2.ok) {
          t2Data = await resT2.json();
        } else {
          const errorDataT2 = await resT2.json().catch(() => ({} as any));
          t2Warn = errorDataT2?.error || 'The Tenant2 SharePoint service is temporarily unavailable.';
        }

        if (!cancelled) {
          setEvents(dataE.events);
          setBlackouts(dataB.blackouts);
          setMsEvents(msData);
          setMsWarning(msWarn);
          setT2Events(t2Data);
          setT2Warning(t2Warn);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Unexpected error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [from, to, reloadTick]);

  // Auto-refresh when window regains focus or tab becomes visible
  useEffect(() => {
    function triggerRefresh() {
      setReloadTick((v: number) => v + 1);
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') triggerRefresh();
    }
    window.addEventListener('focus', triggerRefresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', triggerRefresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Build per-day blackout portion map
  const dayBlackout = useMemo(() => {
    const map = new Map<string, 'none' | 'am' | 'pm' | 'full'>();
    function apply(dateIso: string, portion: 'full'|'am'|'pm') {
      const cur = map.get(dateIso) || 'none';
      if (portion === 'full' || cur === 'full') {
        map.set(dateIso, 'full');
        return;
      }
      if (cur === 'none') {
        map.set(dateIso, portion);
      } else if ((cur === 'am' && portion === 'pm') || (cur === 'pm' && portion === 'am')) {
        map.set(dateIso, 'full');
      }
    }
    for (const b of blackouts) {
      const s = new Date(b.startDate);
      const e = new Date(b.endDate);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        apply(fmtLocalYMD(d), b.portion);
      }
    }
    return map;
  }, [blackouts]);

  const dayEvents = useMemo(() => {
    const map = new Map<string, EventItem[]>();

    // Process local DB events
    for (const e of events) {
      const iso = fmtLocalYMD(new Date(e.date));
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push({ ...e, source: 'local' });
    }

    // Process and merge Microsoft and Tenant2 events, expanding multi-day spans
    const mergedExternal = [...msEvents, ...t2Events];
    for (const msEvent of mergedExternal) {
      const startIso = msEvent?.start?.dateTime?.substring(0, 10);
      const endIsoRaw = msEvent?.end?.dateTime?.substring(0, 10);
      const startHM = msEvent?.start?.dateTime?.substring(11, 16) || '';
      const endHM = msEvent?.end?.dateTime?.substring(11, 16) || '';

      if (!startIso || !endIsoRaw) continue;

      // Determine if end day should be included. If end time is 00:00, treat end day as exclusive
      const endExclusive = endHM === '00:00';
      const endInclusiveIso = endExclusive
        ? (() => { const d = new Date(endIsoRaw); d.setDate(d.getDate() - 1); return fmtLocalYMD(d); })()
        : endIsoRaw;

      // Iterate day by day from startIso to endInclusiveIso
      const cur = new Date(startIso);
      const last = new Date(endInclusiveIso);
      while (cur <= last) {
        const curIso = fmtLocalYMD(cur);
        if (!map.has(curIso)) map.set(curIso, []);

        // Times only on boundary days
        const curStart = curIso === startIso ? (startHM || undefined) : undefined;
        const curEnd = curIso === endInclusiveIso ? (endHM || undefined) : undefined;

        const transformedEvent: EventItem = {
          _id: `${msEvent.id}:${curIso}`,
          date: curIso,
          reason: msEvent.subject,
          createdBy: msEvent.organizer?.emailAddress?.name || 'Microsoft',
          startTime: curStart,
          endTime: curEnd,
          source: msEvent.organizer?.emailAddress?.name === 'Tenant2' ? 'microsoft' : 'microsoft',
        };
        // Note: we keep source as 'microsoft' for styling; below we choose color by organizer name
        map.get(curIso)!.push(transformedEvent);

        cur.setDate(cur.getDate() + 1);
      }
    }

    // Convert blackout ranges into per-day events
    for (const b of blackouts) {
      const s = new Date(b.startDate);
      const e = new Date(b.endDate);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const iso = fmtLocalYMD(d);
        if (!map.has(iso)) map.set(iso, []);
        const reasonText = b.reason ? `Blackout (${b.portion}) - ${b.reason}` : `Blackout (${b.portion})`;
        map.get(iso)!.push({
          _id: `blackout:${b.startDate}:${b.endDate}:${b.portion}:${iso}`,
          date: iso,
          reason: reasonText,
          createdBy: 'system',
          source: 'blackout',
        });
      }
    }

    // Sort events within each day
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const sa = a.startTime || '';
        const sb = b.startTime || '';
        if (sa !== sb) return sa.localeCompare(sb);
        return (a.reason || '').localeCompare(b.reason || '');
      });
    }
    return map;
  }, [events, msEvents, t2Events, blackouts]);

  // Build simple month grid (for Month view)
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  const daysInMonth = last.getDate();
  const startWeekday = first.getDay();

  const cells: Date[] = [];
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(first);
    d.setDate(d.getDate() - (startWeekday - i));
    cells.push(d);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const x = new Date(first);
    x.setDate(d);
    cells.push(x);
  }
  while (cells.length % 7 !== 0) {
    const lastCell = cells[cells.length - 1];
    const x = new Date(lastCell);
    x.setDate(x.getDate() + 1);
    cells.push(x);
  }

  function prevMonth() {
    const x = new Date(cursor);
    if (view === 'week') x.setDate(x.getDate() - 7);
    else if (view === 'year') x.setFullYear(x.getFullYear() - 1);
    else x.setMonth(x.getMonth() - 1);
    setCursor(x);
  }
  function nextMonth() {
    const x = new Date(cursor);
    if (view === 'week') x.setDate(x.getDate() + 7);
    else if (view === 'year') x.setFullYear(x.getFullYear() + 1);
    else x.setMonth(x.getMonth() + 1);
    setCursor(x);
  }

  const monthLabel = view === 'year'
    ? cursor.getFullYear().toString()
    : view === 'week'
    ? `${fmtLocalYMD(startOfWeek(cursor))} → ${fmtLocalYMD(endOfWeek(cursor))}`
    : cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  function gotoMonth(monthIndex: number) {
    const y = cursor.getFullYear();
    const d = new Date(y, monthIndex, 1);
    setCursor(d);
    setView('month');
  }

  function gotoWeek(date: Date) {
    setCursor(new Date(date));
    setView('week');
  }

  // Build week days (for Week view)
  const weekDays: Date[] = useMemo(() => {
    if (view !== 'week') return [];
    const s = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [cursor, view]);

  // Year view aggregation per month
  const monthAgg = useMemo(() => {
    if (view !== 'year') return [] as Array<{ month: number; label: string; count: number; blackout: boolean }>;
    const y = cursor.getFullYear();
    const arr: Array<{ month: number; label: string; count: number; blackout: boolean }> = [];
    for (let m = 0; m < 12; m++) {
      const label = new Date(y, m, 1).toLocaleString(undefined, { month: 'short' });
      arr.push({ month: m, label, count: 0, blackout: false });
    }
    for (const e of dayEvents.values()) {
        for (const event of e) {
            const d = new Date(event.date);
            if (d.getFullYear() === y) arr[d.getMonth()].count++;
        }
    }
    for (const b of blackouts) {
      const s = new Date(b.startDate);
      const e = new Date(b.endDate);
      if (s.getFullYear() !== y && e.getFullYear() !== y) continue;
      const mStart = s.getFullYear() === y ? s.getMonth() : 0;
      const mEnd = e.getFullYear() === y ? e.getMonth() : 11;
      for (let m = mStart; m <= mEnd; m++) arr[m].blackout = true;
    }
    return arr;
  }, [dayEvents, blackouts, cursor, view]);

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
          <button onClick={() => setReloadTick((v) => v + 1)} className="btn btn-outline-secondary">Refresh</button>
        </div>
      </div>

      {msWarning && (
        <div className="alert alert-warning" role="alert">
          {msWarning}
        </div>
      )}
      {t2Warning && (
        <div className="alert alert-warning" role="alert">
          {t2Warning}
        </div>
      )}

      {/* Legend at top */}
      <div className="mb-3" style={{ padding: 8, border: '1px solid #eee', background: '#fff' }}>
        <span style={{ background: '#374151', color: '#fff', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>Blackout</span>
        <span style={{ background: '#bfdbfe', color: '#111', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginLeft: 8 }}>Microsoft</span>
        <span style={{ background: '#fb923c', color: '#111', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginLeft: 8 }}>Tenant2</span>
        <span style={{ background: '#fecaca', color: '#111', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginLeft: 8 }}>Confirmed</span>
        <span style={{ background: '#fef08a', color: '#111', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginLeft: 8 }}>Provisional</span>
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
                ? '#374151'
              : portion === 'am'
                ? 'linear-gradient(to bottom, #374151 50%, #ffffff 50%)'
              : portion === 'pm'
                ? 'linear-gradient(to bottom, #ffffff 50%, #374151 50%)'
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
                  {(dayEvents.get(iso) || [])
                    .filter((ev: EventItem) => ev.source !== 'blackout')
                    .map((e: EventItem, i: number) => {
                    const timeLabel = e.startTime && e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime ? e.startTime : '';
                    const isBlackout = e.source === 'blackout';
                    const labelBg = isBlackout
                      ? '#ef4444'
                      : (e.source === 'microsoft' && e.createdBy === 'Tenant2')
                        ? '#fb923c'
                        : e.source === 'microsoft'
                          ? '#bfdbfe'
                          : e.status === 'confirmed'
                            ? '#fecaca'
                            : '#fef08a';
                    const labelColor = isBlackout ? '#fff' : '#111';
                    const canEdit = e.source === 'local' && currentUser && (currentUser.role === 'admin' || currentUser.sub === e.createdBy);
                    const displayText = e.source === 'microsoft'
                      ? (currentUser && currentUser.role === 'admin' ? (e.reason || 'Busy') : 'Busy')
                      : (e.reason || '')
                    const eventEl = (
                      <span style={{
                        display: 'block',
                        background: labelBg,
                        color: labelColor,
                        padding: '2px 6px',
                        borderRadius: 4,
                        maxWidth: '100%',
                      }}>
                        {timeLabel ? `${timeLabel} ` : ''}{displayText}
                      </span>
                    );
                    return (
                      <div key={i} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
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
                ? '#374151'
                : portion === 'am'
                ? 'linear-gradient(to bottom, #374151 50%, #ffffff 50%)'
                : portion === 'pm'
                ? 'linear-gradient(to bottom, #ffffff 50%, #374151 50%)'
                : 'white';
            return (
              <div key={idx} style={{ padding: 8, border: '1px solid #eee', background: tileBg, minHeight: 120 }}>
                <div style={{ fontWeight: 600 }}>
                  {d.toLocaleDateString(undefined, { weekday: 'short' })} {d.getDate()}
                </div>
                <div style={{ marginTop: 6, textAlign: 'left', fontSize: 12, color: '#111' }}>
                  {(dayEvents.get(iso) || [])
                    .filter((ev: EventItem) => ev.source !== 'blackout')
                    .map((e: EventItem, i: number) => {
                    const timeLabel = e.startTime && e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime ? e.startTime : '';
                    const isBlackout = e.source === 'blackout';
                    const labelBg = isBlackout
                      ? '#ef4444'
                      : (e.source === 'microsoft' && e.createdBy === 'Tenant2')
                        ? '#fb923c'
                        : e.source === 'microsoft'
                          ? '#bfdbfe'
                          : e.status === 'confirmed'
                            ? '#fecaca'
                            : '#fef08a';
                    const labelColor = isBlackout ? '#fff' : '#111';
                    const canEdit = e.source === 'local' && currentUser && (currentUser.role === 'admin' || currentUser.sub === e.createdBy);
                    const displayText = e.source === 'microsoft'
                      ? (currentUser && currentUser.role === 'admin' ? (e.reason || 'Busy') : 'Busy')
                      : (e.reason || '')
                    const eventEl = (
                      <span style={{ background: labelBg, color: labelColor, padding: '2px 6px', borderRadius: 4 }}>
                        {timeLabel ? `${timeLabel} ` : ''}{displayText}
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
          <div style={{ gridColumn: '1 / -1', padding: 8, border: '1px solid #eee', background: '#fff' }}>
            <span style={{ background: '#374151', color: '#fff', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>Blackout</span>
            <span style={{ background: '#bfdbfe', color: '#111', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginLeft: 8 }}>Microsoft</span>
            <span style={{ background: '#fecaca', color: '#111', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginLeft: 8 }}>Confirmed</span>
            <span style={{ background: '#fef08a', color: '#111', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginLeft: 8 }}>Provisional</span>
          </div>
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