const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

let cca = null;
let tokenCache = null;

function getCca() {
  const clientId = process.env.TENANT2_CLIENT_ID;
  const tenantId = process.env.TENANT2_ID;
  const clientSecret = process.env.TENANT2_CLIENT_SECRET;
  if (!clientId || !tenantId || !clientSecret) {
    const missing = [
      !clientId ? 'TENANT2_CLIENT_ID' : null,
      !tenantId ? 'TENANT2_ID' : null,
      !clientSecret ? 'TENANT2_CLIENT_SECRET' : null,
    ].filter(Boolean).join(', ');
    const err = new Error(`Tenant2 credentials not configured: ${missing}`);
    err.code = 'TENANT2_CONFIG_MISSING';
    throw err;
  }
  if (!cca) {
    const msalConfig = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
      }
    };
    cca = new ConfidentialClientApplication(msalConfig);
  }
  return cca;
}

async function getTenant2Token() {
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }
  const req = { scopes: ['https://graph.microsoft.com/.default'] };
  const resp = await getCca().acquireTokenByClientCredential(req);
  const expiresOn = resp.expiresOn;
  const expiresAtMs = expiresOn instanceof Date ? expiresOn.getTime() : (typeof expiresOn === 'number' ? expiresOn * 1000 : Date.now() + 3_000_000);
  tokenCache = { accessToken: resp.accessToken, expiresAtMs };
  return resp.accessToken;
}

function ymd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hhmm(d) {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function toIsoDate(dateOnlyStr) {
  return new Date(`${dateOnlyStr}T00:00:00Z`);
}

async function resolveSiteAndListIds(client) {
  const site = await client.api(`/sites/${process.env.TENANT2_SITE_HOSTNAME || 'irisartstudio.sharepoint.com'}`).get();
  const siteId = site.id;
  if (process.env.TENANT2_LIST_ID) return { siteId, listId: process.env.TENANT2_LIST_ID };
  const listTitle = process.env.TENANT2_LIST_TITLE || 'Iris Art Bookings';
  const list = await client.api(`/sites/${siteId}/lists('${listTitle}')`).get();
  return { siteId, listId: list.id };
}

async function getTenant2ListEvents(from, to) {
  const accessToken = await getTenant2Token();
  const client = Client.init({ authProvider: (done) => done(null, accessToken) });

  const { siteId, listId } = await resolveSiteAndListIds(client);

  const collected = [];
  let url = `/sites/${siteId}/lists/${listId}/items?$expand=fields(select=Title,DateBooked)&$top=50`;

  while (url) {
    const page = await client.api(url).get();
    if (Array.isArray(page.value)) collected.push(...page.value);
    url = page['@odata.nextLink'] ? page['@odata.nextLink'] : null;
  }

  const fromD = from ? new Date(`${from}T00:00:00Z`) : null;
  const toDExclusive = to ? (() => { const d = new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d; })() : null;

  const normalized = [];
  for (const it of collected) {
    const f = it.fields || {};
    const title = f.Title || 'Booking';
    const db = f.DateBooked;
    if (!db) continue;

    let start = null;
    let end = null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(db)) {
      // date-only
      start = new Date(`${db}T00:00:00Z`);
      end = new Date(`${db}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1); // exclusive next day
    } else {
      // datetime
      const dt = new Date(db);
      start = dt;
      end = new Date(dt.getTime() + 60 * 60 * 1000);
    }

    if (fromD && end <= fromD) continue;
    if (toDExclusive && start >= toDExclusive) continue;

    normalized.push({
      id: it.id,
      subject: title,
      organizer: { emailAddress: { name: 'Tenant2' } },
      start: { dateTime: `${ymd(start)}T${hhmm(start)}` },
      end: { dateTime: `${ymd(end)}T${hhmm(end)}` },
    });
  }

  return normalized;
}

module.exports = { getTenant2ListEvents };
