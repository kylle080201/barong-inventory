import connectDB from '@/lib/mongodb';
import { OAuthRefreshToken } from '@/models/OAuth';
import { CORS_HEADERS, corsPreflight, oauthError } from '@/lib/oauth/config';
import { authenticateClient, readParams } from '@/lib/oauth/clients';
import { sha256 } from '@/lib/oauth/tokens';

// RFC 7009 token revocation. Revokes refresh tokens; access tokens simply expire within an hour.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const params = await readParams(request);
  await connectDB();

  const client = await authenticateClient(request, params);
  if (!client) return oauthError('invalid_client', 'Unknown client or bad client credentials', 401);

  const token = params.get('token');
  if (token) {
    await OAuthRefreshToken.updateOne(
      { tokenHash: sha256(token), clientId: client.clientId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }
  // Per RFC 7009, respond 200 whether or not the token was found
  return new Response(null, { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } });
}

export const OPTIONS = corsPreflight;
