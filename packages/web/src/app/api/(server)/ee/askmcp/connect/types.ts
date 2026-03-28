export interface ConnectMcpResponse {
  /** The external OAuth authorization URL the browser should navigate to. Null if already authorized. */
  authorizationUrl: string | null;
}