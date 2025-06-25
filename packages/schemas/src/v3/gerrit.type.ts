// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface GerritConnectionConfig {
  /**
   * Gerrit Configuration
   */
  type: "gerrit";
  /**
   * The URL of the Gerrit host.
   */
  url: string;
  /**
   * Authentication configuration for Gerrit
   */
  auth?: {
    /**
     * Gerrit username for authentication
     */
    username: string;
    /**
     * Gerrit HTTP password (not your account password). Generate this in Gerrit → Settings → HTTP Credentials → Generate Password.
     */
    password:
      | string
      | {
          /**
           * The name of the secret that contains the token.
           */
          secret: string;
        }
      | {
          /**
           * The name of the environment variable that contains the token. Only supported in declarative connection configs.
           */
          env: string;
        };
  };
  /**
   * List of specific projects to sync. If not specified, all projects will be synced. Glob patterns are supported
   */
  projects?: string[];
  exclude?: {
    /**
     * List of specific projects to exclude from syncing.
     */
    projects?: string[];
    /**
     * Exclude read-only projects from syncing.
     */
    readOnly?: boolean;
    /**
     * Exclude hidden projects from syncing.
     */
    hidden?: boolean;
  };
}
