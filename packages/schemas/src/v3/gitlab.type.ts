// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface GitlabConnectionConfig {
  /**
   * GitLab Configuration
   */
  type: "gitlab";
  token?: Token;
  /**
   * The URL of the GitLab host. Defaults to https://gitlab.com
   */
  url?: string;
  /**
   * Sync all projects visible to the provided `token` (if any) in the GitLab instance. This option is ignored if `url` is either unset or set to https://gitlab.com .
   */
  all?: boolean;
  /**
   * List of users to sync with. All projects owned by the user and visible to the provided `token` (if any) will be synced, unless explicitly defined in the `exclude` property.
   */
  users?: string[];
  /**
   * List of groups to sync with. All projects in the group (and recursive subgroups) visible to the provided `token` (if any) will be synced, unless explicitly defined in the `exclude` property. Subgroups can be specified by providing the path to the subgroup (e.g. `my-group/sub-group-a`).
   */
  groups?: string[];
  /**
   * List of individual projects to sync with. The project's namespace must be specified. See: https://docs.gitlab.com/ee/user/namespace/
   */
  projects?: string[];
  /**
   * List of project topics to include when syncing. Only projects that match at least one of the provided `topics` will be synced. If not specified, all projects will be synced, unless explicitly defined in the `exclude` property. Glob patterns are supported.
   *
   * @minItems 1
   */
  topics?: string[];
  exclude?: {
    /**
     * Exclude forked projects from syncing.
     */
    forks?: boolean;
    /**
     * Exclude archived projects from syncing.
     */
    archived?: boolean;
    /**
     * List of projects to exclude from syncing. Glob patterns are supported. The project's namespace must be specified, see: https://docs.gitlab.com/ee/user/namespace/
     */
    projects?: string[];
    /**
     * List of project topics to exclude when syncing. Projects that match one of the provided `topics` will be excluded from syncing. Glob patterns are supported.
     */
    topics?: string[];
  };
  revisions?: GitRevisions;
}
/**
 * An authentication token.
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
