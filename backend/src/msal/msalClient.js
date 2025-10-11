const msal = require('@azure/msal-node');

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Info,
    },
  },
};

// Add this line for debugging
console.log(`[DEBUG] Tenant ID: '${process.env.MICROSOFT_TENANT_ID}'`);

const msalClient = new msal.ConfidentialClientApplication(msalConfig);

module.exports = msalClient;
