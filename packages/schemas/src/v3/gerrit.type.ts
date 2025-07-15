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
     * Gerrit HTTP password (not your account password). Generate this in Gerrit → Settings → HTTP Credentials → Generate Password. Note: HTTP password authentication requires Gerrit's auth.gitBasicAuthPolicy to be set to HTTP or HTTP_LDAP.
     */
    password:
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
  revisions?: GitRevisions;
}
/**
 * The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed. A maximum of 64 revisions can be indexed, with any additional revisions being ignored.
 */
export interface GitRevisions {
  /**
   * List of branches to include when indexing. For a given repo, only the branches that exist on the repo's remote *and* match at least one of the provided `branches` will be indexed. The default branch (HEAD) is always indexed. Glob patterns are supported. A maximum of 64 branches can be indexed, with any additional branches being ignored.
   */
  branches?: string[];
  /**
   * List of tags to include when indexing. For a given repo, only the tags that exist on the repo's remote *and* match at least one of the provided `tags` will be indexed. Glob patterns are supported. A maximum of 64 tags can be indexed, with any additional tags being ignored.
   */
  tags?: string[];
}
