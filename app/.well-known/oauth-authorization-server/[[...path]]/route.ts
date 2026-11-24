import { corsPreflight, getAuthorizationServerMetadata, jsonResponse } from '@/lib/oauth/config';

// RFC 8414 authorization server metadata.
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return jsonResponse(getAuthorizationServerMetadata(request), 200, { 'Cache-Control': 'public, max-age=3600' });
}

export const OPTIONS = corsPreflight;
