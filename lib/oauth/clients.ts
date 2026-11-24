import connectDB from '@/lib/mongodb';
import { OAuthClient, IOAuthClient } from '@/models/OAuth';
import { safeEqual, sha256 } from './tokens';

export async function findClient(clientId: string | null | undefined) {
  if (!clientId || clientId.length > 200) return null;
  await connectDB();
  return OAuthClient.findOne({ clientId }).lean<IOAuthClient>();
}

/**
 * Identifies and authenticates the client on the token/revoke endpoints.
 * Public clients send only client_id; confidential ones use Basic auth or client_secret in the body.
 */
export async function authenticateClient(request: Request, params: URLSearchParams) {
  let clientId = params.get('client_id');
  let clientSecret = params.get('client_secret');

  const header = request.headers.get('authorization');
  if (header?.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const sep = decoded.indexOf(':');
      if (sep >= 0) {
        clientId = decodeURIComponent(decoded.slice(0, sep));
        clientSecret = decodeURIComponent(decoded.slice(sep + 1));
      }
    } catch {
      return null;
    }
  }

  const client = await findClient(clientId);
  if (!client) return null;

  if (client.tokenEndpointAuthMethod === 'none') return client;
  // Either secret method is accepted: some clients register one and send the other
  if (!clientSecret || !client.clientSecretHash) return null;
  return safeEqual(sha256(clientSecret), client.clientSecretHash) ? client : null;
}

/** Reads a token/revoke request body (form-encoded per spec; JSON tolerated). */
export async function readParams(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body || {})) {
      if (typeof v === 'string') params.set(k, v);
    }
    return params;
  }
  return new URLSearchParams(await request.text());
}
