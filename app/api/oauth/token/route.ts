import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { OAuthCode, OAuthRefreshToken } from '@/models/OAuth';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  corsPreflight,
  getBaseUrl,
  getResourceUrl,
  jsonResponse,
  oauthError,
} from '@/lib/oauth/config';
import { authenticateClient, readParams } from '@/lib/oauth/clients';
import { issueAccessToken, randomToken, sha256, verifyPkce } from '@/lib/oauth/tokens';

// OAuth token endpoint: authorization_code (with PKCE) and refresh_token (rotating) grants.
export const dynamic = 'force-dynamic';

async function issueTokens(request: Request, userId: string, clientId: string, scope: string, resource: string) {
  const user: any = await User.findById(userId).lean();
  if (!user) return oauthError('invalid_grant', 'User no longer exists');

  const accessToken = issueAccessToken(
    { id: String(user._id), email: user.email, name: user.name, role: user.role },
    { clientId, scope, resource, issuer: getBaseUrl(request) }
  );

  const refreshToken = randomToken(32);
  await OAuthRefreshToken.create({
    tokenHash: sha256(refreshToken),
    clientId,
    userId: String(user._id),
    scope,
    resource,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
  });

  return jsonResponse({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope,
  });
}

export async function POST(request: Request) {
  const params = await readParams(request);
  await connectDB();

  const client = await authenticateClient(request, params);
  if (!client) return oauthError('invalid_client', 'Unknown client or bad client credentials', 401);

  const grantType = params.get('grant_type');
  const resourceUrl = getResourceUrl(request);
  const resource = params.get('resource');
  if (resource && resource.replace(/\/+$/, '') !== resourceUrl) {
    return oauthError('invalid_target', `resource must be ${resourceUrl}`);
  }

  if (grantType === 'authorization_code') {
    const code = params.get('code');
    const verifier = params.get('code_verifier');
    if (!code || !verifier) return oauthError('invalid_request', 'code and code_verifier are required');

    // One-time use: delete as we read it
    const record = await OAuthCode.findOneAndDelete({ codeHash: sha256(code) }).lean();
    if (!record || record.expiresAt.getTime() < Date.now()) {
      return oauthError('invalid_grant', 'Authorization code is invalid or expired');
    }
    if (record.clientId !== client.clientId) return oauthError('invalid_grant', 'Code was issued to another client');
    const redirectUri = params.get('redirect_uri');
    if (redirectUri && redirectUri !== record.redirectUri) {
      return oauthError('invalid_grant', 'redirect_uri does not match the authorization request');
    }
    if (!verifyPkce(verifier, record.codeChallenge)) return oauthError('invalid_grant', 'PKCE verification failed');

    return issueTokens(request, record.userId, client.clientId, record.scope, record.resource);
  }

  if (grantType === 'refresh_token') {
    const token = params.get('refresh_token');
    if (!token) return oauthError('invalid_request', 'refresh_token is required');

    // Rotate: the old refresh token stops working as soon as it's used
    const record = await OAuthRefreshToken.findOneAndUpdate(
      { tokenHash: sha256(token), revokedAt: null },
      { $set: { revokedAt: new Date() } }
    ).lean();
    if (!record || record.expiresAt.getTime() < Date.now()) {
      return oauthError('invalid_grant', 'Refresh token is invalid, expired or already used');
    }
    if (record.clientId !== client.clientId) return oauthError('invalid_grant', 'Token was issued to another client');

    return issueTokens(request, record.userId, client.clientId, record.scope, record.resource);
  }

  return oauthError('unsupported_grant_type', 'grant_type must be authorization_code or refresh_token');
}

export const OPTIONS = corsPreflight;
