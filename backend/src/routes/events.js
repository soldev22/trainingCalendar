const express = require('express');
const Event = require('../models/Event');
const Blackout = require('../models/Blackout');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// --- blackout overlap helpers ---
function timeToMinutes(t) {
  if (!t) return null;
  const [hh, mm] = t.split(':');
  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// return true if [s1,e1) overlaps [s2,e2)
function rangeOverlap(s1, e1, s2, e2) {
  return s1 < e2 && s2 < e1;
}

// Given event start/end minutes (null => open) and a blackout portion, decide conflict
function conflictsWithPortion(eventStartMin, eventEndMin, portion) {
  // Interpret all-day if nulls
  const start = eventStartMin == null ? 0 : eventStartMin;
  const end = eventEndMin == null ? 24 * 60 : eventEndMin;
  if (portion === 'full') return true;
  const AM_START = 0, AM_END = 12 * 60; // [00:00,12:00)
  const PM_START = 12 * 60, PM_END = 24 * 60; // [12:00,24:00)
  if (portion === 'am') return rangeOverlap(start, end, AM_START, AM_END);
  if (portion === 'pm') return rangeOverlap(start, end, PM_START, PM_END);
  return false;
}

// Create a new event
router.post('/', requireAuth, async (req, res) => {
  try {
    const { date, reason, notes, status, startTime, endTime } = req.body;
    if (!date || !reason) {
      return res.status(400).json({ ok: false, error: 'date and reason are required' });
    }

    let finalStatus = 'provisional';
    if (status) {
      if (!['provisional', 'confirmed'].includes(status)) {
        return res.status(400).json({ ok: false, error: "status must be 'provisional' or 'confirmed'" });
      }
      finalStatus = status;
    }

    // validate times if provided
    const timeRe = /^\d{2}:\d{2}$/;
    if (startTime && !timeRe.test(startTime)) {
      return res.status(400).json({ ok: false, error: 'startTime must be HH:MM' });
    }
    if (endTime && !timeRe.test(endTime)) {
      return res.status(400).json({ ok: false, error: 'endTime must be HH:MM' });
    }
    if (startTime && endTime && startTime >= endTime) {
      return res.status(400).json({ ok: false, error: 'endTime must be after startTime' });
    }

    // blackout enforcement
    const eventDate = new Date(date);
    const bos = await Blackout.find({ startDate: { $lte: eventDate }, endDate: { $gte: eventDate } });
    const eStartMin = timeToMinutes(startTime);
    const eEndMin = timeToMinutes(endTime);
    for (const b of bos) {
      if (conflictsWithPortion(eStartMin, eEndMin, b.portion)) {
        return res.status(409).json({ ok: false, error: 'Date/time is blacked out and not bookable' });
      }
    }

    const event = await Event.create({ date, reason, notes, status: finalStatus, startTime, endTime, createdBy: req.user.id });
    return res.status(201).json({ ok: true, event });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// List a user's own events, optionally filtered by date range
router.get('/my-events', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const query = { createdBy: req.user.id };

    if (from || to) {
      query.date = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) query.date.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          query.date.$lte = toDate;
        }
      }
    }

    const events = await Event.find(query).sort({ date: 1, createdAt: -1 }).lean();
    return res.status(200).json({ ok: true, events });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// List events, optionally filtered by date range
// GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    const query = {};

    if (from || to) {
      query.date = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) query.date.$gte = fromDate;
      }
      if (to) {
        // include entire day for 'to'
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          query.date.$lte = toDate;
        }
      }
    }

    const events = await Event.find(query).sort({ date: 1, createdAt: -1 }).lean();
    if (req.user) {
      return res.status(200).json({ ok: true, events });
    }
    // Hide reason for unauthenticated
    const redacted = events.map(({ reason, ...rest }) => rest);
    return res.status(200).json({ ok: true, events: redacted });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Get a single event by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id).lean();
    if (!event) return res.status(404).json({ ok: false, error: 'Event not found' });
    if (req.user) return res.status(200).json({ ok: true, event });
    const { reason, ...rest } = event;
    return res.status(200).json({ ok: true, event: rest });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Update event fields (date, reason, status)
// PUT /api/events/:id  body: { date?, reason?, status? }
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, reason, status, startTime, endTime } = req.body;

    const update = {};
    if (date) {
      const d = new Date(date);
      if (isNaN(d.getTime())) return res.status(400).json({ ok: false, error: 'Invalid date' });
      update.date = d;
    }
    if (reason !== undefined) {
      if (typeof reason !== 'string' || reason.trim().length === 0) {
        return res.status(400).json({ ok: false, error: 'reason must be non-empty string' });
      }
      update.reason = reason;
    }
    if (status !== undefined) {
      if (!['provisional', 'confirmed'].includes(status)) {
        return res.status(400).json({ ok: false, error: "status must be 'provisional' or 'confirmed'" });
      }
      update.status = status;
    }

    // validate times if provided
    const timeRe = /^\d{2}:\d{2}$/;
    if (startTime !== undefined) {
      if (startTime !== null && startTime !== '' && !timeRe.test(startTime)) {
        return res.status(400).json({ ok: false, error: 'startTime must be HH:MM' });
      }
      update.startTime = startTime;
    }
    if (endTime !== undefined) {
      if (endTime !== null && endTime !== '' && !timeRe.test(endTime)) {
        return res.status(400).json({ ok: false, error: 'endTime must be HH:MM' });
      }
      update.endTime = endTime;
    }
    if ((startTime !== undefined || endTime !== undefined) && (update.startTime ?? startTime) && (update.endTime ?? endTime)) {
      const s = (update.startTime ?? startTime);
      const e = (update.endTime ?? endTime);
      if (s && e && s >= e) {
        return res.status(400).json({ ok: false, error: 'endTime must be after startTime' });
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid fields to update' });
    }

    // blackout enforcement for PUT: get effective values
    const existing = await Event.findById(id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Event not found' });

    // Authorization check
    if (req.user.role !== 'admin' && existing.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    if (!existing) return res.status(404).json({ ok: false, error: 'Event not found' });
    const effDate = update.date || existing.date;
    const effStart = (update.startTime !== undefined ? update.startTime : existing.startTime) || null;
    const effEnd = (update.endTime !== undefined ? update.endTime : existing.endTime) || null;
    const bos = await Blackout.find({ startDate: { $lte: effDate }, endDate: { $gte: effDate } });
    const eStartMin = timeToMinutes(effStart);
    const eEndMin = timeToMinutes(effEnd);
    for (const b of bos) {
      if (conflictsWithPortion(eStartMin, eEndMin, b.portion)) {
        return res.status(409).json({ ok: false, error: 'Date/time is blacked out and not bookable' });
      }
    }

    const event = await Event.findByIdAndUpdate(id, update, { new: true });
    if (!event) return res.status(404).json({ ok: false, error: 'Event not found' });
    return res.status(200).json({ ok: true, event });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete an event
// DELETE /api/events/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ ok: false, error: 'Event not found' });

    // Authorization check
    if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const deleted = await Event.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Event not found' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
