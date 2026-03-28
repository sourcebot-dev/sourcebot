import 'server-only';
import type {
  OAuthClientProvider,
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from '@ai-sdk/mcp';
// Note: We use the raw (unscoped) prisma client here intentionally. The user-scoped
// prisma extension only filters Repo queries, and all MCP queries in this file already
// filter explicitly by userId and/or serverId, so scoping would be a no-op.
import { prisma } from '@/prisma';
import { encryptOAuthToken, decryptOAuthToken } from '@sourcebot/shared';

/**
 * Prisma-backed OAuthClientProvider for connecting to external MCP servers.
 *
 * Stores dynamic client registration (client_id/secret) on McpServer (per-org),
 * and per-user tokens + ephemeral PKCE state on McpServerCredential.
 */
export class PrismaOAuthClientProvider implements OAuthClientProvider {
  constructor(
    private readonly serverId: string,
    private readonly userId: string,
    private readonly callbackUrl: string,
  ) {}

  /** Populated by redirectToAuthorization — read after auth() returns 'REDIRECT'. */
  public authorizationUrl: string | undefined;

  get redirectUrl(): string | URL {
    return this.callbackUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.callbackUrl],
      client_name: 'Sourcebot',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const server = await prisma.mcpServer.findUnique({
      where: { id: this.serverId },
      select: { clientInfo: true },
    });
    if (!server?.clientInfo) return undefined;

    const decrypted = decryptOAuthToken(server.clientInfo);
    return decrypted ? JSON.parse(decrypted) : undefined;
  }

  async saveClientInformation(info: OAuthClientInformation): Promise<void> {
    const encrypted = encryptOAuthToken(JSON.stringify(info));
    await prisma.mcpServer.update({
      where: { id: this.serverId },
      data: { clientInfo: encrypted },
    });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const cred = await this.getOrCreateCredential();
    if (!cred.tokens) return undefined;

    const decrypted = decryptOAuthToken(cred.tokens);
    return decrypted ? JSON.parse(decrypted) : undefined;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const encrypted = encryptOAuthToken(JSON.stringify(tokens));
    const tokensExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;
    await prisma.mcpServerCredential.update({
      where: { userId_serverId: { userId: this.userId, serverId: this.serverId } },
      data: { tokens: encrypted, tokensExpiresAt },
    });
  }

  async codeVerifier(): Promise<string> {
    const cred = await this.getOrCreateCredential();
    if (!cred.codeVerifier) {
      throw new Error('No code verifier found');
    }
    return cred.codeVerifier;
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.upsertCredential({ codeVerifier });
  }

  async state(): Promise<string> {
    return crypto.randomUUID();
  }

  async saveState(state: string): Promise<void> {
    await this.upsertCredential({ state });
  }

  async storedState(): Promise<string | undefined> {
    const cred = await this.getOrCreateCredential();
    return cred.state ?? undefined;
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    // Force the OAuth provider to show a consent/login screen on every authorization.
    // This prevents a stolen-session attack where an attacker signs into Sourcebot on
    // a victim's machine and silently obtains the victim's provider tokens via an
    // existing browser session.
    if (!url.searchParams.has('prompt')) {
      url.searchParams.set('prompt', 'consent');
    }

    // Clear any stale tokens from the database. This is called when the SDK determines
    // that existing tokens are no longer valid (e.g., the access token expired and the
    // refresh token was revoked). Clearing them ensures the UI reflects "not connected"
    // so the user knows to re-authenticate, rather than staying stuck in a state where
    // the server appears connected but all tool calls fail.
    await this.invalidateCredentials('tokens');

    this.authorizationUrl = url.toString();
  }

  async invalidateCredentials(
    scope: 'all' | 'client' | 'tokens' | 'verifier',
  ): Promise<void> {
    if (scope === 'all' || scope === 'client') {
      await prisma.mcpServer.update({
        where: { id: this.serverId },
        data: { clientInfo: null },
      });
    }

    if (scope === 'all' || scope === 'tokens') {
      await this.upsertCredential({ tokens: null });
    }

    if (scope === 'all' || scope === 'verifier') {
      await this.upsertCredential({ codeVerifier: null, state: null });
    }
  }

  private async getOrCreateCredential() {
    return prisma.mcpServerCredential.upsert({
      where: {
        userId_serverId: { userId: this.userId, serverId: this.serverId },
      },
      create: { userId: this.userId, serverId: this.serverId },
      update: {},
    });
  }

  private async upsertCredential(data: {
    tokens?: string | null;
    codeVerifier?: string | null;
    state?: string | null;
  }) {
    await prisma.mcpServerCredential.upsert({
      where: {
        userId_serverId: { userId: this.userId, serverId: this.serverId },
      },
      create: { userId: this.userId, serverId: this.serverId, ...data },
      update: data,
    });
  }
}