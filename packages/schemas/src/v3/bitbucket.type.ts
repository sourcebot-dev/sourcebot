// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface BitbucketConnectionConfig {
  /**
   * Bitbucket configuration
   */
  type: "bitbucket";
  /**
   * The username to use for API authentication. For app passwords, this is your Bitbucket username. For API tokens, this is your Bitbucket account email address.
   */
  user?: string;
  /**
   * The username to use for git clone authentication over HTTPS. If not set, falls back to 'user'. For API tokens, this is your Bitbucket username
   */
  gitUser?: string;
  /**
   * An authentication token.
   */
  token?:
    | {
        /**
         * The name of the environment variable that contains the token.
         */
        env: string;
      }
    | {
        /**
         * The resource name of a Google Cloud secret. Must be in the format `projects/<project-id>/secrets/<secret-name>/versions/<version-id>`. See https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets
         */
        googleCloudSecret: string;
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
   * Sync all repositories visible to the provided `token` (if any) in the Bitbucket Server instance. This option is ignored if `deploymentType` is `cloud`.
   */
  all?: boolean;
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
  /**
   * Controls whether repository permissions are enforced for this connection. When `PERMISSION_SYNC_ENABLED` is false, this setting has no effect. Defaults to the value of `PERMISSION_SYNC_ENABLED`. See https://docs.sourcebot.dev/docs/features/permission-syncing
   */
  enforcePermissions?: boolean;
  /**
   * Controls whether repository permissions are enforced for public repositories in this connection. When true, public repositories are only visible to users with a linked account for this connection's code host. When false, public repositories are visible to all users. Has no effect when enforcePermissions is false. Defaults to false. See https://docs.sourcebot.dev/docs/features/permission-syncing
   */
  enforcePermissionsForPublicRepos?: boolean;
}
/**
 * The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed first. Sourcebot can index at most 64 total revisions per repository, including the default branch. Matching branches are considered before matching tags, and any revisions beyond the 64 revision limit are ignored.
 */
export interface GitRevisions {
  /**
   * List of branches to include when indexing. For a given repo, only the branches that exist on the repo's remote *and* match at least one of the provided `branches` will be indexed. The default branch (HEAD) is always indexed. Glob patterns are supported. Matching branches are considered before matching tags, and the combined default branch, branch, and tag revision list is capped at 64 total revisions.
   */
  branches?: string[];
  /**
   * Sort order to use when listing candidate branches before matching branch glob patterns and applying the global 64 revision limit. Values map to Git `for-each-ref` sort keys. `committerdate` and `creatordate` sort newest-first, while `refname` sorts lexicographically by ref name. For branches, `creatordate` follows Git object creator-date semantics and is not a branch creation timestamp.
   */
  branchSort?: "committerdate" | "creatordate" | "refname";
  /**
   * List of tags to include when indexing. For a given repo, only the tags that exist on the repo's remote *and* match at least one of the provided `tags` will be indexed. Glob patterns are supported. Matching tags are considered after matching branches, and the combined default branch, branch, and tag revision list is capped at 64 total revisions.
   */
  tags?: string[];
  /**
   * Sort order to use when listing candidate tags before matching tag glob patterns and applying the global 64 revision limit. Values map to Git `for-each-ref` sort keys. `committerdate` and `creatordate` sort newest-first, while `refname` sorts lexicographically by ref name.
   */
  tagSort?: "committerdate" | "creatordate" | "refname";
}
