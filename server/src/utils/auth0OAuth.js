import { config } from '../config.js';

function requireAuth0Config() {
  if (!config.auth0Domain || !config.auth0ClientId || !config.auth0ClientSecret) {
    throw new Error('Auth0 is not fully configured. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET in .env');
  }
}

export function getAuth0CallbackUrl(req) {
  if (config.auth0CallbackUrl) return config.auth0CallbackUrl;
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}/api/auth/oauth/callback`;
}

export function buildAuthorizeUrl({ state, redirectUri }) {
  requireAuth0Config();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.auth0ClientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state,
    connection: config.auth0GoogleConnection,
  });
  return `https://${config.auth0Domain}/authorize?${params}`;
}

export async function exchangeAuthorizationCode(code, redirectUri) {
  requireAuth0Config();
  const res = await fetch(`https://${config.auth0Domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.auth0ClientId,
      client_secret: config.auth0ClientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body.error_description || body.error || 'Auth0 token exchange failed';
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (!body.id_token) {
    throw new Error('Auth0 did not return an ID token');
  }
  return body;
}

export function buildLogoutUrl(returnTo) {
  requireAuth0Config();
  const params = new URLSearchParams({
    client_id: config.auth0ClientId,
    returnTo,
  });
  return `https://${config.auth0Domain}/v2/logout?${params}`;
}
