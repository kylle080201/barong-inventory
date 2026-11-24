import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyToken } from '@/lib/jwt';
import { createInventoryMcpServer } from '@/lib/mcp/server';
import { CORS_HEADERS, corsPreflight, getBaseUrl, getResourceUrl } from '@/lib/oauth/config';
import { verifyAccessToken } from '@/lib/oauth/tokens';

// MCP endpoint (Streamable HTTP, stateless). Clients authenticate with
// `Authorization: Bearer <token>`, using either an OAuth access token (ChatGPT, claude.ai, …)
// or a long-lived token from `npm run mcp-token <email>`.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function unauthorized(request: Request, message: string, invalidToken: boolean) {
  const metadataUrl = `${getBaseUrl(request)}/.well-known/oauth-protected-resource/api/mcp`;
  const challenge = [
    'Bearer realm="barong-inventory"',
    `resource_metadata="${metadataUrl}"`,
    'scope="inventory"',
    ...(invalidToken ? ['error="invalid_token"', `error_description="${message}"`] : []),
  ].join(', ');

  return new Response(
    JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message }, id: null }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': challenge, ...CORS_HEADERS },
    }
  );
}

async function handle(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return unauthorized(request, 'Missing bearer token', false);

  const user =
    verifyAccessToken(token, { resource: getResourceUrl(request), issuer: getBaseUrl(request) }) ??
    verifyToken(token);
  if (!user?.id) return unauthorized(request, 'Invalid or expired token', true);

  // Stateless: a fresh server and transport per request, bound to this user
  const server = createInventoryMcpServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  try {
    return withCors(await transport.handleRequest(request));
  } finally {
    // JSON responses are fully built by now, so it's safe to close
    await transport.close();
    await server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
export const OPTIONS = corsPreflight;
