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
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) { // 60s buffer
    return tokenCache.accessToken;
  }

  const clientCredentialRequest = {
    scopes: ['https://graph.microsoft.com/.default'], // Use .default scope for client credentials
  };

  try {
    const response = await cca.acquireTokenByClientCredential(clientCredentialRequest);
    const expiresOn = response.expiresOn; // Date or epoch seconds depending on library version
    const expiresAtMs = expiresOn instanceof Date
      ? expiresOn.getTime()
      : (typeof expiresOn === 'number' ? expiresOn * 1000 : Date.now() + 3_000_000);
    tokenCache = {
      accessToken: response.accessToken,
      expiresAtMs,
    }; // Cache the new token with computed expiry in ms
    return response.accessToken;
  } catch (error) {
    console.error('Failed to acquire app-only token:', error);
    tokenCache = null; // Clear cache on failure
    throw error;
  }
}

/**
 * Initializes a Graph client with an app-only token and fetches calendar events within a date range.
 * @param {string|undefined} from - inclusive start date (YYYY-MM-DD)
 * @param {string|undefined} to - inclusive end date (YYYY-MM-DD)
 */
async function getCalendarEvents(from, to) {
  const userId = process.env.MICROSOFT_USER_ID;
  if (!userId) {
    throw new Error('MICROSOFT_USER_ID is not defined in the .env file.');
  }

  // Build ISO date-time range in UTC. calendarView expects endDateTime EXCLUSIVE.
  // So we use [fromT00:00:00Z, (to+1)T00:00:00Z)
  const startDateTime = from
    ? new Date(`${from}T00:00:00Z`).toISOString()
    : new Date().toISOString();
  const endDateTime = to
    ? (() => {
        const d = new Date(`${to}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString();
      })()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  async function fetchRange(accessToken) {
    const client = Client.init({ authProvider: (done) => done(null, accessToken) });
    const collected = [];

    let request = client
      .api(`/users/${userId}/calendarView`)
      .header('Prefer', 'outlook.timezone="GMT Standard Time"')
      .query({ startDateTime, endDateTime })
      .select('id,subject,organizer,start,end')
      .orderby('start/dateTime ASC')
      .top(50);

    // First page
    let page = await request.get();
    if (Array.isArray(page.value)) collected.push(...page.value);

    // Paginate if nextLink present
    while (page['@odata.nextLink']) {
      const nextLink = page['@odata.nextLink'];
      page = await client.api(nextLink).get();
      if (Array.isArray(page.value)) collected.push(...page.value);
    }

    return collected;
  }

  try {
    const accessToken = await getAppOnlyToken();
    return await fetchRange(accessToken);
  } catch (error) {
    if ((error?.statusCode === 401 || error?.code === 'InvalidAuthenticationToken') && tokenCache) {
      try {
        tokenCache = null;
        const freshToken = await getAppOnlyToken();
        return await fetchRange(freshToken);
      } catch (retryErr) {
        console.error(`Retry after clearing token cache failed for ${userId}:`, retryErr);
      }
    }
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
