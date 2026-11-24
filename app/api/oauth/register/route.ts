import connectDB from '@/lib/mongodb';
import { OAuthClient } from '@/models/OAuth';
import { corsPreflight, isAllowedRedirectUri, jsonResponse, oauthError } from '@/lib/oauth/config';
import { randomToken, sha256 } from '@/lib/oauth/tokens';

// RFC 7591 dynamic client registration, used by ChatGPT, claude.ai and other MCP clients.
// Registering only creates a client record; every connection still needs the user's approval.
export const dynamic = 'force-dynamic';

const AUTH_METHODS = ['none', 'client_secret_post', 'client_secret_basic'] as const;

export async function POST(request: Request) {
  const body: any = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return oauthError('invalid_client_metadata', 'Body must be a JSON object');
  }

  const redirectUris = body.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    redirectUris.length > 10 ||
    !redirectUris.every((u: unknown) => typeof u === 'string' && u.length <= 2000 && isAllowedRedirectUri(u))
  ) {
    return oauthError(
      'invalid_redirect_uri',
      'redirect_uris must be 1-10 https URLs (or http on localhost)'
    );
  }

  const authMethod = body.token_endpoint_auth_method ?? 'none';
  if (!AUTH_METHODS.includes(authMethod)) {
    return oauthError('invalid_client_metadata', `token_endpoint_auth_method must be one of: ${AUTH_METHODS.join(', ')}`);
  }

  const grantTypes: string[] = body.grant_types ?? ['authorization_code', 'refresh_token'];
  if (!Array.isArray(grantTypes) || !grantTypes.includes('authorization_code') ||
      grantTypes.some((g) => !['authorization_code', 'refresh_token'].includes(g))) {
    return oauthError('invalid_client_metadata', 'grant_types must include authorization_code (and optionally refresh_token)');
  }
  const responseTypes: string[] = body.response_types ?? ['code'];
  if (!Array.isArray(responseTypes) || responseTypes.some((r) => r !== 'code')) {
    return oauthError('invalid_client_metadata', 'response_types must be ["code"]');
  }

  const clientName =
    typeof body.client_name === 'string' && body.client_name.trim()
      ? body.client_name.trim().slice(0, 100)
      : 'Unnamed MCP client';

  const clientId = `mcp_${randomToken(16)}`;
  const clientSecret = authMethod === 'none' ? undefined : randomToken(32);

  await connectDB();
  await OAuthClient.create({
    clientId,
    clientSecretHash: clientSecret ? sha256(clientSecret) : undefined,
    clientName,
    redirectUris,
    tokenEndpointAuthMethod: authMethod,
  });

  return jsonResponse(
    {
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: authMethod,
      grant_types: grantTypes,
      response_types: ['code'],
      scope: 'inventory',
    },
    201
  );
}

export const OPTIONS = corsPreflight;
