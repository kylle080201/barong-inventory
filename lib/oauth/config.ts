// Shared OAuth settings for the MCP endpoint.

export const OAUTH_SCOPE = 'inventory';
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const AUTH_CODE_TTL_SECONDS = 60 * 10; // 10 minutes

/**
 * Public base URL of the app (the OAuth issuer). Uses OAUTH_ISSUER or NEXTAUTH_URL when set,
 * otherwise the request's host (honouring proxy headers, e.g. on Vercel).
 */
export function getBaseUrl(request: Request): string {
  const configured = process.env.OAUTH_ISSUER || process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || url.protocol.replace(':', '');
  return `${proto}://${host.split(',')[0].trim()}`;
}

/** The protected resource (the MCP endpoint) that access tokens are issued for. */
export function getResourceUrl(request: Request): string {
  return `${getBaseUrl(request)}/api/mcp`;
}

export function getAuthorizationServerMetadata(request: Request) {
  const base = getBaseUrl(request);
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: [OAUTH_SCOPE],
    service_documentation: `${base}/`,
  };
}

export function getProtectedResourceMetadata(request: Request) {
  const base = getBaseUrl(request);
  return {
    resource: getResourceUrl(request),
    authorization_servers: [base],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'Barong Inventory',
  };
}

/** Redirect URIs must be https, or http on this machine (for local clients). */
export function isAllowedRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.hash) return false;
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:') {
      return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    }
    return false;
  } catch {
    return false;
  }
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export function oauthError(error: string, description: string, status = 400) {
  return jsonResponse({ error, error_description: description }, status);
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
