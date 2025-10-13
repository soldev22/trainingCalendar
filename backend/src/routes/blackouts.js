const express = require('express');
const Blackout = require('../models/Blackout');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Create a blackout range
// body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', portion: 'full'|'am'|'pm', reason? }
router.post('/', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, portion, reason } = req.body;
    if (!startDate || !endDate || !portion) {
      return res.status(400).json({ ok: false, error: 'startDate, endDate and portion are required' });
    }
    if (!['full', 'am', 'pm'].includes(portion)) {
      return res.status(400).json({ ok: false, error: "portion must be 'full', 'am', or 'pm'" });
    }
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return res.status(400).json({ ok: false, error: 'Invalid date(s)' });
    }
    if (e < s) {
      return res.status(400).json({ ok: false, error: 'endDate must be after or equal to startDate' });
    }

    const blackout = await Blackout.create({ startDate: s, endDate: e, portion, reason });
    return res.status(201).json({ ok: true, blackout });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Get blackouts intersecting a range
// query: from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ ok: false, error: 'from and to are required' });
    }
    const f = new Date(from);
    const t = new Date(to);
    if (isNaN(f.getTime()) || isNaN(t.getTime())) {
      return res.status(400).json({ ok: false, error: 'Invalid from/to' });
    }
    // Intersect where [startDate,endDate] overlaps [from,to]
    const blackouts = await Blackout.find({
      $and: [
        { startDate: { $lte: t } },
        { endDate: { $gte: f } },
      ],
    }).sort({ startDate: 1 });
    return res.status(200).json({ ok: true, blackouts });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Update a blackout by id
// body: may include any of startDate, endDate, portion, reason
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, portion, reason } = req.body;
    const update = {};
    if (startDate !== undefined) {
      const s = new Date(startDate);
      if (isNaN(s.getTime())) return res.status(400).json({ ok: false, error: 'Invalid startDate' });
      update.startDate = s;
    }
    if (endDate !== undefined) {
      const e = new Date(endDate);
      if (isNaN(e.getTime())) return res.status(400).json({ ok: false, error: 'Invalid endDate' });
      update.endDate = e;
    }
    if (portion !== undefined) {
      if (!['full', 'am', 'pm'].includes(portion)) {
        return res.status(400).json({ ok: false, error: "portion must be 'full', 'am', or 'pm'" });
      }
      update.portion = portion;
    }
    if (reason !== undefined) update.reason = reason;
    if (update.startDate && update.endDate && update.endDate < update.startDate) {
      return res.status(400).json({ ok: false, error: 'endDate must be after or equal to startDate' });
    }
    const blackout = await Blackout.findByIdAndUpdate(id, update, { new: true });
    if (!blackout) return res.status(404).json({ ok: false, error: 'Not found' });
    return res.status(200).json({ ok: true, blackout });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete a blackout by id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Blackout.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ ok: false, error: 'Not found' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
