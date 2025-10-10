const express = require('express');
const router = express.Router();
const msalClient = require('../msal/msalClient');

// The scopes (permissions) we are requesting from the user's calendar
const scopes = ['openid', 'profile', 'offline_access', 'user.read', 'calendars.readwrite'];

// Endpoint to start the sign-in process
router.get('/signin', async (req, res) => {
  const authCodeUrlParameters = {
    scopes: scopes,
    redirectUri: `https://mikesdiary.up.railway.app/api/auth/microsoft/callback`, // Replace with your actual URL
  };

  try {
    const authUrl = await msalClient.getAuthCodeUrl(authCodeUrlParameters);
    res.redirect(authUrl);
  } catch (error) {
    console.log(error);
    res.status(500).send('Error generating auth URL');
  }
});

// Callback endpoint where Microsoft redirects after login
router.get('/callback', async (req, res) => {
  const tokenRequest = {
    code: req.query.code,
    scopes: scopes,
    redirectUri: `https://mikesdiary.up.railway.app/api/auth/microsoft/callback`, // Replace with your actual URL
  };

  try {
    const response = await msalClient.acquireTokenByCode(tokenRequest);
    // TODO: Store the access token and refresh token securely, likely associated with the logged-in user.
    console.log('Acquired token successfully!');
    console.log(response);

    // For now, just send a success message. In a real app, you'd redirect the user back to the frontend.
    res.status(200).send('Authentication successful! You can close this window.');
  } catch (error) {
    console.log(error);
    res.status(500).send('Error acquiring token');
  }
});

module.exports = router;
