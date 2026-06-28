// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface GithubConnectionConfig {
  /**
   * GitHub Configuration
   */
  type: "github";
  /**
   * A Personal Access Token (PAT).
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
   * The URL of the GitHub host. Defaults to https://github.com
   */
  url?: string;
  /**
   * List of users to sync with. All repositories that the user owns will be synced, unless explicitly defined in the `exclude` property.
   */
  users?: string[];
  /**
   * List of organizations to sync with. All repositories in the organization visible to the provided `token` (if any) will be synced, unless explicitly defined in the `exclude` property.
   */
  orgs?: string[];
  /**
   * List of individual repositories to sync with. Expected to be formatted as '{orgName}/{repoName}' or '{userName}/{repoName}'.
   */
  repos?: string[];
  /**
   * List of repository topics to include when syncing. Only repositories that match at least one of the provided `topics` will be synced. If not specified, all repositories will be synced, unless explicitly defined in the `exclude` property. Glob patterns are supported.
   *
   * @minItems 1
   */
  topics?: string[];
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
    /**
     * List of repository topics to exclude when syncing. Repositories that match one of the provided `topics` will be excluded from syncing. Glob patterns are supported.
     */
    topics?: string[];
    /**
     * Exclude repositories based on their disk usage. Note: the disk usage is calculated by GitHub and may not reflect the actual disk usage when cloned.
     */
    size?: {
      /**
       * Minimum repository size (in bytes) to sync (inclusive). Repositories less than this size will be excluded from syncing.
       */
      min?: number;
      /**
       * Maximum repository size (in bytes) to sync (inclusive). Repositories greater than this size will be excluded from syncing.
       */
      max?: number;
    };
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
