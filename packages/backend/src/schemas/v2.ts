// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export type Repos = GitHubConfig | GitLabConfig | GiteaConfig | LocalConfig | GerritConfig;
/**
 * List of branches to include when indexing. For a given repo, only the branches that exist on the repo's remote *and* match at least one of the provided `branches` will be indexed. The default branch (HEAD) is always indexed. Glob patterns are supported.
 */
export type Branches = string[];
/**
 * List of tags to include when indexing. For a given repo, only the tags that exist on the repo's remote *and* match at least one of the provided `tags` will be indexed. Glob patterns are supported.
 */
export type Tags = string[];

/**
 * A Sourcebot configuration file outlines which repositories Sourcebot should sync and index.
 */
export interface SourcebotConfigurationSchema {
  $schema?: string;
  /**
   * Defines a collection of repositories from varying code hosts that Sourcebot should sync with.
   */
  repos?: Repos[];
}
export interface GitHubConfig {
  /**
   * GitHub Configuration
   */
  type: "github";
  /**
   * A Personal Access Token (PAT).
   */
  token?:
    | string
    | {
        /**
         * The name of the environment variable that contains the token.
         */
        env: string;
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
     * List of individual repositories to exclude from syncing. Expected to be formatted as '{orgName}/{repoName}' or '{userName}/{repoName}'.
     */
    repos?: string[];
  };
  revisions?: GitRevisions;
}
/**
 * The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed.
 */
export interface GitRevisions {
  branches?: Branches;
  tags?: Tags;
}
export interface GitLabConfig {
  /**
   * GitLab Configuration
   */
  type: "gitlab";
  /**
   * An authentication token.
   */
  token?:
    | string
    | {
        /**
         * The name of the environment variable that contains the token.
         */
        env: string;
      };
  /**
   * The URL of the GitLab host. Defaults to https://gitlab.com
   */
  url?: string;
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
     * List of individual projects to exclude from syncing. The project's namespace must be specified. See: https://docs.gitlab.com/ee/user/namespace/
     */
    projects?: string[];
  };
  revisions?: GitRevisions;
}
export interface GiteaConfig {
  /**
   * Gitea Configuration
   */
  type: "gitea";
  /**
   * An access token.
   */
  token?:
    | string
    | {
        /**
         * The name of the environment variable that contains the token.
         */
        env: string;
      };
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
     * List of individual repositories to exclude from syncing. Expected to be formatted as '{orgName}/{repoName}' or '{userName}/{repoName}'.
     */
    repos?: string[];
  };
  revisions?: GitRevisions;
}
export interface LocalConfig {
  /**
   * Local Configuration
   */
  type: "local";
  /**
   * Path to the local directory to sync with. Relative paths are relative to the configuration file's directory.
   */
  path: string;
  /**
   * Enables a file watcher that will automatically re-sync when changes are made within `path` (recursively). Defaults to true.
   */
  watch?: boolean;
  exclude?: {
    /**
     * List of paths relative to the provided `path` to exclude from the index. .git, .hg, and .svn are always excluded.
     */
    paths?: string[];
  };
}
export interface GerritConfig {
  /**
   * Gerrit Configuration
   */
  type: "gerrit";
  /**
   * The URL of the Gerrit host.
   */
  url: string;
  /**
   * The maximum number of projects to fetch.
   */
  limit?: number;
  /**
   * List of specific projects to sync. If not specified, all projects will be synced.
   */
  projects?: string[];
  exclude?: {
    /**
     * List of specific projects to exclude from syncing.
     */
    projects?: string[];
  };
  revisions?: GitRevisions;
}
