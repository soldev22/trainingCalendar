const express = require('express');
const router = express.Router();
const { getCalendarEvents, probeCalendarHealth } = require('../msal/msalClient');

// Route to get calendar events for the configured user
router.get('/events', async (req, res) => {
    try {
        const { from, to } = req.query;
        const events = await getCalendarEvents(from, to);
        res.json(events);
    } catch (error) {
        console.error('Error fetching MS calendar events:', error.message);
        // We send a 503 Service Unavailable because the backend is misconfigured or MS Graph is down
        res.status(503).json({ error: 'The Microsoft Calendar service is temporarily unavailable.' });
    }
});

router.get('/health', async (req, res) => {
    try {
        const result = await probeCalendarHealth();
        const code = typeof result.httpStatus === 'number' ? result.httpStatus : 200;
        res.status(code).json(result);
    } catch (error) {
        res.status(503).json({ ok: false, status: 'DOWN', httpStatus: 503, message: error?.message || 'Unknown error' });
    }
});

module.exports = router;