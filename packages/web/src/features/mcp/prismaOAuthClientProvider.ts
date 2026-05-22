import 'server-only';
import type {
  OAuthClientProvider,
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from '@ai-sdk/mcp';
import type { PrismaClient } from '@sourcebot/db';
import { encryptOAuthToken, decryptOAuthToken } from '@sourcebot/shared';

/**
 * Prisma-backed OAuthClientProvider for connecting to external MCP servers.
 *
 * Stores dynamic client registration (client_id/secret) on McpServer (per-org),
 * and per-user tokens + ephemeral PKCE state on UserMcpServer.
 */
export class PrismaOAuthClientProvider implements OAuthClientProvider {
  constructor(
    private readonly prisma: PrismaClient,
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
    const server = await this.prisma.mcpServer.findUnique({
      where: { id: this.serverId },
      select: { clientInfo: true },
    });
    if (!server?.clientInfo) {
      return undefined;
    }

    const decrypted = decryptOAuthToken(server.clientInfo);
    return decrypted ? JSON.parse(decrypted) : undefined;
  }

  async saveClientInformation(info: OAuthClientInformation): Promise<void> {
    const encrypted = encryptOAuthToken(JSON.stringify(info));
    await this.prisma.mcpServer.update({
      where: { id: this.serverId },
      data: { clientInfo: encrypted },
    });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const userServer = await this.getUserServer();
    if (!userServer?.tokens) {
      return undefined;
    }

    const decrypted = decryptOAuthToken(userServer.tokens);
    return decrypted ? JSON.parse(decrypted) : undefined;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const encrypted = encryptOAuthToken(JSON.stringify(tokens));
    const tokensExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;
    await this.prisma.userMcpServer.update({
      where: { userId_serverId: { userId: this.userId, serverId: this.serverId } },
      data: { tokens: encrypted, tokensExpiresAt },
    });
  }

  async codeVerifier(): Promise<string> {
    const userServer = await this.getUserServer();
    if (!userServer?.codeVerifier) {
      throw new Error('No code verifier found');
    }
    return userServer.codeVerifier;
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.updateUserServer({ codeVerifier });
  }

  async state(): Promise<string> {
    return crypto.randomUUID();
  }

  async saveState(state: string): Promise<void> {
    await this.updateUserServer({ state });
  }

  async storedState(): Promise<string | undefined> {
    const userServer = await this.getUserServer();
    return userServer?.state ?? undefined;
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
      await this.prisma.mcpServer.update({
        where: { id: this.serverId },
        data: { clientInfo: null },
      });
    }

    if (scope === 'all' || scope === 'tokens') {
      await this.updateUserServer({ tokens: null, tokensExpiresAt: null });
    }

    if (scope === 'all' || scope === 'verifier') {
      await this.updateUserServer({ codeVerifier: null, state: null });
    }
  }

  private async getUserServer() {
    return this.prisma.userMcpServer.findUnique({
      where: {
        userId_serverId: { userId: this.userId, serverId: this.serverId },
      },
      select: {
        tokens: true,
        codeVerifier: true,
        state: true,
      },
    });
  }

  private async updateUserServer(data: {
    tokens?: string | null;
    tokensExpiresAt?: Date | null;
    codeVerifier?: string | null;
    state?: string | null;
  }) {
    await this.prisma.userMcpServer.update({
      where: {
        userId_serverId: { userId: this.userId, serverId: this.serverId },
      },
      data,
    });
  }
}
