import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { TokenPayload } from '@/lib/jwt';
import { ACCESS_TOKEN_TTL_SECONDS, OAUTH_SCOPE } from './config';

const BASE_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production';

// A key derived from NEXTAUTH_SECRET, so OAuth access tokens only work on /api/mcp and are
// never accepted by the rest of the API (which verifies with NEXTAUTH_SECRET directly).
const ACCESS_TOKEN_KEY = crypto.createHmac('sha256', BASE_SECRET).update('mcp-oauth-access-token').digest();

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** PKCE S256: BASE64URL(SHA256(verifier)) must equal the challenge. */
export function verifyPkce(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = crypto.createHash('sha256').update(verifier).digest('base64url');
  return safeEqual(computed, challenge);
}

interface AccessTokenUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function issueAccessToken(
  user: AccessTokenUser,
  opts: { clientId: string; scope: string; resource: string; issuer: string }
) {
  return jwt.sign(
    {
      email: user.email,
      name: user.name,
      role: user.role,
      client_id: opts.clientId,
      scope: opts.scope,
      typ: 'mcp_access',
    },
    ACCESS_TOKEN_KEY,
    {
      subject: user.id,
      audience: opts.resource,
      issuer: opts.issuer,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    }
  );
}

/** Verifies an OAuth access token for this resource; returns the user or null. */
export function verifyAccessToken(
  token: string,
  opts: { resource: string; issuer: string }
): TokenPayload | null {
  try {
    const claims = jwt.verify(token, ACCESS_TOKEN_KEY, {
      audience: opts.resource,
      issuer: opts.issuer,
    }) as jwt.JwtPayload;
    if (claims.typ !== 'mcp_access' || !claims.sub) return null;
    if (!String(claims.scope || '').split(' ').includes(OAUTH_SCOPE)) return null;
    return { id: claims.sub, email: claims.email, name: claims.name, role: claims.role };
  } catch {
    return null;
  }
}
