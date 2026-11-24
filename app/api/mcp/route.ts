import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyToken } from '@/lib/jwt';
import { createInventoryMcpServer } from '@/lib/mcp/server';

// MCP endpoint (Streamable HTTP, stateless). Clients authenticate with
// `Authorization: Bearer <token>` — create one with `npm run mcp-token <email>`.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized(message: string) {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message }, id: null }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="barong-inventory"',
      },
    }
  );
}

async function handle(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return unauthorized('Missing bearer token');

  const user = verifyToken(token);
  if (!user?.id) return unauthorized('Invalid or expired token');

  // Stateless: a fresh server and transport per request, bound to this user
  const server = createInventoryMcpServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    // JSON responses are fully built by now, so it's safe to close
    await transport.close();
    await server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
