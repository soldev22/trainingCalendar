const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const msalConfig = {
  auth: {
    clientId: process.env.MS_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}`,
    clientSecret: process.env.MS_CLIENT_SECRET,
  }
};

const cca = new ConfidentialClientApplication(msalConfig);

// In-memory cache for the application token
let tokenCache = null;

/**
 * Acquires a token for the application (not on behalf of a user).
 */
async function getAppOnlyToken() {
  // If we have a valid, non-expired token in cache, return it
  if (tokenCache && tokenCache.expiresOn * 1000 > Date.now() + 60000) { // 60s buffer
    return tokenCache.accessToken;
  }

  const clientCredentialRequest = {
    scopes: ['https://graph.microsoft.com/.default'], // Use .default scope for client credentials
  };

  try {
    const response = await cca.acquireTokenByClientCredential(clientCredentialRequest);
    tokenCache = response; // Cache the new token
    return response.accessToken;
  } catch (error) {
    console.error('Failed to acquire app-only token:', error);
    tokenCache = null; // Clear cache on failure
    throw error;
  }
}

/**
 * Initializes a Graph client with an app-only token and fetches calendar events.
 */
async function getCalendarEvents() {
  const userId = process.env.MICROSOFT_USER_ID;
  if (!userId) {
    throw new Error('MICROSOFT_USER_ID is not defined in the .env file.');
  }

  try {
    const accessToken = await getAppOnlyToken();

    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });

    const events = await client
      .api(`/users/${userId}/events`)
      .select('subject,organizer,start,end')
      .orderby('start/dateTime DESC')
      .get();

    return events.value;
  } catch (error) {
    console.error(`Failed to get calendar events for ${userId}:`, error);
    throw new Error('Could not retrieve calendar events from Microsoft Graph.');
  }
}

module.exports = {
  getCalendarEvents
};
