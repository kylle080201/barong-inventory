import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getBaseUrl, getResourceUrl } from '@/lib/oauth/config';
import { buildRedirect, validateAuthorizeRequest } from '@/lib/oauth/authorize';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// OAuth authorization endpoint: asks the signed-in user to approve an MCP client.
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Can&apos;t connect this app</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Try connecting again from the app. If it keeps happening, remove the connector there and add it again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  // Build a Request-like object so URL helpers see the same host/proxy headers as API routes
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || 'http';
  const request = new Request(`${proto}://${host}/oauth/authorize`, { headers: h });

  const get = (key: string) => first(searchParams[key]);
  const result = await validateAuthorizeRequest(get, getResourceUrl(request));

  if (result.kind === 'fatal') return <ErrorCard message={result.message} />;
  if (result.kind === 'redirect_error') {
    redirect(
      buildRedirect(result.redirectUri, {
        error: result.error,
        error_description: result.description,
        state: result.state,
        iss: getBaseUrl(request),
      })
    );
  }
  const params = result.params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      const value = first(v);
      if (value !== undefined) query.set(k, value);
    }
    redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`);
  }

  const redirectHost = new URL(params.redirectUri).host;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect {params.clientName}?</CardTitle>
          <CardDescription>
            Signed in as {session.user.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            <span className="font-medium">{params.clientName}</span> wants access to your Barong Inventory. It will
            be able to:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>See your products, stock and sales</li>
            <li>Record and edit sales (which changes stock)</li>
            <li>Add and edit products, and restock</li>
          </ul>
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            After you approve, you&apos;ll be sent to <span className="font-medium text-foreground">{redirectHost}</span>.
            Only approve if you just started connecting this app yourself.
          </p>

          <form method="post" action="/api/oauth/authorize" className="flex gap-2">
            <input type="hidden" name="client_id" value={params.clientId} />
            <input type="hidden" name="redirect_uri" value={params.redirectUri} />
            <input type="hidden" name="response_type" value="code" />
            <input type="hidden" name="code_challenge" value={params.codeChallenge} />
            <input type="hidden" name="code_challenge_method" value="S256" />
            <input type="hidden" name="resource" value={params.resource} />
            {params.state !== undefined && <input type="hidden" name="state" value={params.state} />}
            <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button type="submit" name="decision" value="approve" className="flex-1">
              Approve
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
