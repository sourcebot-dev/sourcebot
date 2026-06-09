import 'server-only';
import type {
  OAuthClientProvider,
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from '@ai-sdk/mcp';
import { McpServerClientInfoSource, type PrismaClient } from '@sourcebot/db';
import { encryptOAuthToken, decryptOAuthToken, createLogger } from '@sourcebot/shared';
import { __unsafePrisma } from '@/prisma';
import { createMcpOAuthState } from './mcpOAuthReturnTo';
import { normalizeMcpRequestedOAuthScopes, OFFLINE_ACCESS_SCOPE } from './oauthScopeUtils';

type McpOAuthPrismaClient = Pick<PrismaClient, 'mcpServer' | 'userMcpServer'>;
const logger = createLogger('mcp-oauth-client-provider');

interface PrismaOAuthClientProviderOptions {
  prisma: McpOAuthPrismaClient;
  serverId: string;
  orgId: number;
  userId: string;
  callbackUrl: string;
  callbackReturnTo?: string;
  allowClientRegistration?: boolean;
  requestedOAuthScopes?: string[];
  clientInvalidationPrisma?: McpOAuthPrismaClient;
}

export interface ClearMcpServerClientCredentialsOptions {
  prisma?: McpOAuthPrismaClient;
  serverId: string;
  orgId: number;
  observedClientInfo: string | undefined;
}

export async function clearMcpServerClientCredentialsForObservedClient({
  prisma = __unsafePrisma,
  serverId,
  orgId,
  observedClientInfo,
}: ClearMcpServerClientCredentialsOptions): Promise<boolean> {
  if (!observedClientInfo) {
    return false;
  }

  const result = await prisma.mcpServer.updateMany({
    where: {
      id: serverId,
      orgId,
      clientInfo: observedClientInfo,
      clientInfoSource: McpServerClientInfoSource.DYNAMIC,
    },
    data: { clientInfo: null },
  });

  if (result.count === 0) {
    return false;
  }

  await prisma.userMcpServer.updateMany({
    where: {
      serverId,
      server: { orgId },
    },
    data: {
      tokens: null,
      tokensExpiresAt: null,
    },
  });

  return true;
}

/**
 * Prisma-backed OAuthClientProvider for connecting to external MCP servers.
 *
 * Stores dynamic client registration on McpServer (per-org), and per-user
 * tokens + ephemeral PKCE state on UserMcpServer.
 */
export class PrismaOAuthClientProvider implements OAuthClientProvider {
  private readonly prisma: McpOAuthPrismaClient;
  private readonly clientInvalidationPrisma: McpOAuthPrismaClient;
  private readonly serverId: string;
  private readonly orgId: number;
  private readonly userId: string;
  private readonly callbackUrl: string;
  private readonly callbackReturnTo: string | undefined;
  private readonly requestedOAuthScopes: string[];
  private observedClientInfo: string | undefined;
  private observedClientInfoSource: McpServerClientInfoSource | undefined;

  /** Populated by redirectToAuthorization — read after auth() returns 'REDIRECT'. */
  public authorizationUrl: string | undefined;

  /** Only present in connect mode. If absent, the SDK cannot perform DCR. */
  declare saveClientInformation?: (info: OAuthClientInformation) => Promise<void>;

  constructor({
    prisma,
    serverId,
    orgId,
    userId,
    callbackUrl,
    callbackReturnTo,
    allowClientRegistration = false,
    requestedOAuthScopes = [],
    clientInvalidationPrisma = __unsafePrisma,
  }: PrismaOAuthClientProviderOptions) {
    this.prisma = prisma;
    this.clientInvalidationPrisma = clientInvalidationPrisma;
    this.serverId = serverId;
    this.orgId = orgId;
    this.userId = userId;
    this.callbackUrl = callbackUrl;
    this.callbackReturnTo = callbackReturnTo;
    // offline_access is always injected because every client declares the refresh_token grant
    // and providers such as Atlassian reject /authorize when the grant is declared but
    // offline_access is absent. We inject unconditionally rather than checking the provider's
    // advertised scopes because oauthScopesSupported is not plumbed through to this constructor;
    // the tradeoff (a benign unknown-scope rejection on strict providers) is the same as the
    // existing behaviour of always declaring refresh_token.
    this.requestedOAuthScopes = normalizeMcpRequestedOAuthScopes([
        ...requestedOAuthScopes,
        OFFLINE_ACCESS_SCOPE,
    ]);

    if (allowClientRegistration) {
      this.saveClientInformation = async (info: OAuthClientInformation) => {
        const encrypted = encryptOAuthToken(JSON.stringify(info));
        if (!encrypted) {
          throw new Error('Failed to encrypt OAuth client information');
        }

        const result = await this.prisma.mcpServer.updateMany({
          where: { id: this.serverId, orgId: this.orgId },
          data: {
            clientInfo: encrypted,
            clientInfoSource: McpServerClientInfoSource.DYNAMIC,
          },
        });
        if (result.count === 0) {
          throw new Error('MCP server not found');
        }

        this.observedClientInfo = encrypted;
        this.observedClientInfoSource = McpServerClientInfoSource.DYNAMIC;
      };
    }
  }

  get redirectUrl(): string | URL {
    return this.callbackUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    const scope = this.requestedOAuthScopes.join(' ');

    return {
      redirect_uris: [this.callbackUrl],
      client_name: 'Sourcebot',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      ...(scope ? { scope } : {}),
    };
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const server = await this.prisma.mcpServer.findFirst({
      where: { id: this.serverId, orgId: this.orgId },
      select: {
        clientInfo: true,
        clientInfoSource: true,
      },
    });
    if (!server?.clientInfo) {
      this.observedClientInfo = undefined;
      this.observedClientInfoSource = undefined;
      return undefined;
    }

    this.observedClientInfo = server.clientInfo;
    this.observedClientInfoSource = server.clientInfoSource;
    const decrypted = decryptOAuthToken(server.clientInfo);
    return decrypted ? JSON.parse(decrypted) : undefined;
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
    if (!encrypted) {
      throw new Error('Failed to encrypt OAuth tokens');
    }

    const tokensExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;
    await this.updateUserServer({ tokens: encrypted, tokensExpiresAt });
  }

  async codeVerifier(): Promise<string> {
    const userServer = await this.getUserServer();
    if (!userServer?.codeVerifier) {
      throw new Error('No code verifier found');
    }

    const decrypted = decryptOAuthToken(userServer.codeVerifier);
    if (!decrypted) {
      throw new Error('Failed to decrypt OAuth code verifier');
    }

    if (decrypted === userServer.codeVerifier) {
      logger.warn('MCP OAuth code verifier was read without decryption; it may be plaintext from an older version.', {
        serverId: this.serverId,
        orgId: this.orgId,
        userId: this.userId,
      });
    }

    return decrypted;
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    const encrypted = encryptOAuthToken(codeVerifier);
    if (!encrypted) {
      throw new Error('Failed to encrypt OAuth code verifier');
    }

    await this.updateUserServer({ codeVerifier: encrypted });
  }

  async state(): Promise<string> {
    return createMcpOAuthState(crypto.randomUUID(), this.callbackReturnTo);
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
    url.searchParams.set('prompt', 'consent');

    // Clear stale tokens before starting a new authorization flow so the UI reflects
    // that the user needs to complete OAuth again.
    await this.invalidateCredentials('tokens');

    this.authorizationUrl = url.toString();
  }

  async invalidateCredentials(
    scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery',
  ): Promise<void> {
    if (scope === 'discovery') {
      return;
    }

    if (scope === 'all' || scope === 'client') {
      const didClearDynamicClient = await clearMcpServerClientCredentialsForObservedClient({
        prisma: this.clientInvalidationPrisma,
        serverId: this.serverId,
        orgId: this.orgId,
        observedClientInfo: this.observedClientInfo,
      });
      if (
        scope === 'all' &&
        !didClearDynamicClient &&
        this.observedClientInfoSource === McpServerClientInfoSource.STATIC
      ) {
        await this.updateUserServer({ tokens: null, tokensExpiresAt: null });
      }
    }

    if (scope === 'tokens') {
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
