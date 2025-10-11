const express = require('express');
const router = express.Router();
const { getCalendarEvents } = require('../msal/msalClient');

// Route to get calendar events for the configured user
router.get('/events', async (req, res) => {
    try {
        const events = await getCalendarEvents();
        res.json(events);
    } catch (error) {
        console.error('Error fetching MS calendar events:', error.message);
        // We send a 503 Service Unavailable because the backend is misconfigured or MS Graph is down
        res.status(503).json({ error: 'The Microsoft Calendar service is temporarily unavailable.' });
    }
});

module.exports = router;