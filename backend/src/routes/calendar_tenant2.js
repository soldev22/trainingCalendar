const express = require('express');
const router = express.Router();
const { getTenant2ListEvents } = require('../msal/msalClientTenant2');

// GET /api/calendar/tenant2?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    const items = await getTenant2ListEvents(from, to);
    res.json(items);
  } catch (error) {
    console.error('[tenant2] Error fetching SharePoint list events:', error?.message || error);
    res.status(503).json({ error: 'The Tenant2 SharePoint service is temporarily unavailable.' });
  }
});

module.exports = router;
