import { OAUTH_SCOPE } from './config';
import { findClient } from './clients';

export interface AuthorizeParams {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  scope: string;
  resource: string;
}

export type AuthorizeValidation =
  | { kind: 'ok'; params: AuthorizeParams }
  /** Client or redirect URI can't be trusted: show an error, never redirect. */
  | { kind: 'fatal'; message: string }
  /** Redirect back to the client with an OAuth error. */
  | { kind: 'redirect_error'; redirectUri: string; error: string; description: string; state?: string };

/** Validates an authorization request (from the query string or the approval form). */
export async function validateAuthorizeRequest(
  get: (key: string) => string | null | undefined,
  resourceUrl: string
): Promise<AuthorizeValidation> {
  const clientId = get('client_id');
  const client = await findClient(clientId);
  if (!client) return { kind: 'fatal', message: 'Unknown application (client_id).' };

  const redirectUri = get('redirect_uri') || (client.redirectUris.length === 1 ? client.redirectUris[0] : null);
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return { kind: 'fatal', message: 'The redirect address does not match what this application registered.' };
  }

  const state = get('state') || undefined;
  const fail = (error: string, description: string): AuthorizeValidation => ({
    kind: 'redirect_error',
    redirectUri,
    error,
    description,
    state,
  });

  if (get('response_type') !== 'code') return fail('unsupported_response_type', 'response_type must be code');

  const codeChallenge = get('code_challenge');
  if (!codeChallenge || !/^[A-Za-z0-9\-._~]{43,128}$/.test(codeChallenge)) {
    return fail('invalid_request', 'PKCE code_challenge is required');
  }
  if (get('code_challenge_method') !== 'S256') {
    return fail('invalid_request', 'code_challenge_method must be S256');
  }

  const resource = get('resource');
  if (resource && resource.replace(/\/+$/, '') !== resourceUrl) {
    return fail('invalid_target', `resource must be ${resourceUrl}`);
  }

  // Only one scope exists; requests for other scopes are granted just "inventory"
  return {
    kind: 'ok',
    params: {
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUri,
      state,
      codeChallenge,
      scope: OAUTH_SCOPE,
      resource: resourceUrl,
    },
  };
}

export function buildRedirect(redirectUri: string, values: Record<string, string | undefined>) {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  return url.toString();
}
