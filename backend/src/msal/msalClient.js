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
      .header('Prefer', 'outlook.timezone="GMT Standard Time"') // Request times in a specific timezone
      .select('subject,organizer,start,end')
      .orderby('start/dateTime DESC')
      .get();

    return events.value;
  } catch (error) {
    console.error(`Failed to get calendar events for ${userId}:`, error);
    throw new Error('Could not retrieve calendar events from Microsoft Graph.');
  }
}

async function probeCalendarHealth() {
  const userId = process.env.MICROSOFT_USER_ID;
  if (!userId) {
    return { ok: false, status: 'NOT_CONFIGURED', httpStatus: 500 };
  }

  try {
    const accessToken = await getAppOnlyToken();
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });

    const res = await client
      .api(`/users/${userId}/events`)
      .select('id')
      .top(1)
      .get();

    return { ok: true, status: 'UP', httpStatus: 200, count: Array.isArray(res.value) ? res.value.length : 0 };
  } catch (error) {
    const httpStatus = error?.statusCode || error?.code || 503;
    let status = 'DOWN';
    if (httpStatus === 429) status = 'THROTTLED';
    if (httpStatus >= 500) status = 'DEGRADED';
    const retryAfter = error?.responseHeaders?.['retry-after'] || error?.headers?.['retry-after'] || null;
    return {
      ok: false,
      status,
      httpStatus,
      retryAfter,
      message: error?.message || 'Unknown error'
    };
  }
}

module.exports = {
  getCalendarEvents,
  probeCalendarHealth
};
