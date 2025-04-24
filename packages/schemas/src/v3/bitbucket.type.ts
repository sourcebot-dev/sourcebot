// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface BitbucketConnectionConfig {
  /**
   * Bitbucket configuration
   */
  type: "bitbucket";
  /**
   * The username to use for authentication. Only needed if token is an app password.
   */
  user?: string;
  /**
   * An authentication token.
   */
  token?:
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
  /**
   * Bitbucket URL
   */
  url?: string;
  /**
   * The type of Bitbucket deployment
   */
  deploymentType?: "cloud" | "server";
  /**
   * List of workspaces to sync. Ignored if deploymentType is server.
   */
  workspaces?: string[];
  /**
   * List of projects to sync
   */
  projects?: string[];
  /**
   * List of repos to sync
   */
  repos?: string[];
  exclude?: {
    /**
     * Exclude archived repositories from syncing.
     */
    archived?: boolean;
    /**
     * Exclude forked repositories from syncing.
     */
    forks?: boolean;
    /**
     * List of specific repos to exclude from syncing.
     */
    repos?: string[];
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
