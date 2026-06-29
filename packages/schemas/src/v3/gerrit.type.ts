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
