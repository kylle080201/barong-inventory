import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import { OAuthCode } from '@/models/OAuth';
import { AUTH_CODE_TTL_SECONDS, getBaseUrl, getResourceUrl } from '@/lib/oauth/config';
import { buildRedirect, validateAuthorizeRequest } from '@/lib/oauth/authorize';
import { randomToken, sha256 } from '@/lib/oauth/tokens';

// Handles the Approve / Cancel buttons on /oauth/authorize.
export const dynamic = 'force-dynamic';

function errorPage(message: string, status = 400) {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

function seeOther(location: string) {
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const base = getBaseUrl(request);

  // Only accept the form from our own approval page
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(base).origin) return errorPage('Cross-site request rejected', 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return errorPage('Cross-site request rejected', 403);

  const form = await request.formData();
  const get = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value : null;
  };

  const result = await validateAuthorizeRequest(get, getResourceUrl(request));
  if (result.kind === 'fatal') return errorPage(result.message);
  if (result.kind === 'redirect_error') {
    return seeOther(
      buildRedirect(result.redirectUri, {
        error: result.error,
        error_description: result.description,
        state: result.state,
        iss: base,
      })
    );
  }
  const params = result.params;

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return errorPage('You need to be signed in. Go back and try connecting again.', 401);

  if (get('decision') !== 'approve') {
    return seeOther(
      buildRedirect(params.redirectUri, {
        error: 'access_denied',
        error_description: 'The user declined access',
        state: params.state,
        iss: base,
      })
    );
  }

  const code = randomToken(32);
  await connectDB();
  await OAuthCode.create({
    codeHash: sha256(code),
    clientId: params.clientId,
    userId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    scope: params.scope,
    resource: params.resource,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
  });

  return seeOther(buildRedirect(params.redirectUri, { code, state: params.state, iss: base }));
}
