const express = require('express');
const router = express.Router();
const msalClient = require('../msal/msalClient');

// The scopes (permissions) we are requesting from the user's calendar
const scopes = ['openid', 'profile', 'offline_access', 'user.read', 'calendars.readwrite'];

module.exports = router;
