// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface GiteaConnectionConfig {
  /**
   * Gitea Configuration
   */
  type: "gitea";
  token?: Token;
  /**
   * The URL of the Gitea host. Defaults to https://gitea.com
   */
  url?: string;
  /**
   * List of organizations to sync with. All repositories in the organization visible to the provided `token` (if any) will be synced, unless explicitly defined in the `exclude` property. If a `token` is provided, it must have the read:organization scope.
   */
  orgs?: string[];
  /**
   * List of individual repositories to sync with. Expected to be formatted as '{orgName}/{repoName}' or '{userName}/{repoName}'.
   */
  repos?: string[];
  /**
   * List of users to sync with. All repositories that the user owns will be synced, unless explicitly defined in the `exclude` property. If a `token` is provided, it must have the read:user scope.
   */
  users?: string[];
  exclude?: {
    /**
     * Exclude forked repositories from syncing.
     */
    forks?: boolean;
    /**
     * Exclude archived repositories from syncing.
     */
    archived?: boolean;
    /**
     * List of individual repositories to exclude from syncing. Glob patterns are supported.
     */
    repos?: string[];
  };
  revisions?: GitRevisions;
}
/**
 * A Personal Access Token (PAT).
 */
export interface Token {
  /**
   * The name of the secret that contains the token.
   */
  secret: string;
}
/**
 * The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed.
 */
export interface GitRevisions {
  /**
   * List of branches to include when indexing. For a given repo, only the branches that exist on the repo's remote *and* match at least one of the provided `branches` will be indexed. The default branch (HEAD) is always indexed. Glob patterns are supported.
   */
  branches?: string[];
  /**
   * List of tags to include when indexing. For a given repo, only the tags that exist on the repo's remote *and* match at least one of the provided `tags` will be indexed. Glob patterns are supported.
   */
  tags?: string[];
}
