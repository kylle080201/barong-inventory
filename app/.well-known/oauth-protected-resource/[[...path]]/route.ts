import { corsPreflight, getProtectedResourceMetadata, jsonResponse } from '@/lib/oauth/config';

// RFC 9728 protected resource metadata for /api/mcp. Served at both
// /.well-known/oauth-protected-resource and /.well-known/oauth-protected-resource/api/mcp.
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return jsonResponse(getProtectedResourceMetadata(request), 200, { 'Cache-Control': 'public, max-age=3600' });
}

export const OPTIONS = corsPreflight;
