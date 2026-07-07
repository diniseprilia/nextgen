import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';

let jwks;

function getJwks() {
  if (!jwks) {
    const issuer = `https://${config.auth0Domain}/`;
    jwks = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`));
  }
  return jwks;
}

export async function verifyAuth0IdToken(idToken) {
  if (!config.auth0Domain || !config.auth0ClientId) {
    throw new Error('Auth0 is not configured on the server');
  }

  const issuer = `https://${config.auth0Domain}/`;
  const { payload } = await jwtVerify(idToken, getJwks(), {
    issuer,
    audience: config.auth0ClientId,
    clockTolerance: 30,
  });

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  const sub = typeof payload.sub === 'string' ? payload.sub : null;

  if (!email) {
    throw new Error('Auth0 token has no email claim');
  }
  if (!sub) {
    throw new Error('Auth0 token has no subject claim');
  }

  return { email, sub };
}
