// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

/**
 * This interface was referenced by `SourcebotConfigurationSchema`'s JSON-Schema
 * via the `definition` "Repos".
 */
export type Repos = GitHubConfig | GitLabConfig | GiteaConfig | GerritConfig | LocalConfig | GitConfig;
/**
 * This interface was referenced by `SourcebotConfigurationSchema`'s JSON-Schema
 * via the `definition` "Token".
 */
export type Token =
  | string
  | {
      /**
       * The name of the environment variable that contains the token.
       */
      env: string;
    };

/**
 * A Sourcebot configuration file outlines which repositories Sourcebot should sync and index.
 */
export interface SourcebotConfigurationSchema {
  $schema?: string;
  settings?: Settings;
  /**
   * Defines a collection of repositories from varying code hosts that Sourcebot should sync with.
   */
  repos?: Repos[];
}
/**
 * Global settings. These settings are applied to all repositories.
 *
 * This interface was referenced by `SourcebotConfigurationSchema`'s JSON-Schema
 * via the `definition` "Settings".
 */
export interface Settings {
  /**
   * The maximum size of a file (in bytes) to be indexed. Files that exceed this maximum will not be inexed. Defaults to 2MB (2097152 bytes).
   */
  maxFileSize?: number;
  /**
   * Automatically delete stale repositories from the index. Defaults to true.
   */
  autoDeleteStaleRepos?: boolean;
  /**
   * The interval (in milliseconds) at which the indexer should re-index all repositories. Repositories are always indexed when first added. Defaults to 1 hour (3600000 milliseconds).
   */
  reindexInterval?: number;
  /**
   * The interval (in milliseconds) at which the configuration file should be re-synced. The configuration file is always synced on startup. Defaults to 24 hours (86400000 milliseconds).
   */
  resyncInterval?: number;
}
/**
 * This interface was referenced by `SourcebotConfigurationSchema`'s JSON-Schema
 * via the `definition` "GitHubConfig".
 */
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
  /**
   * List of repository topics to include when syncing. Only repositories that match at least one of the provided `topics` will be synced. If not specified, all repositories will be synced, unless explicitly defined in the `exclude` property. Glob patterns are supported.
   *
   * @minItems 1
   */
  topics?: string[];
  /**
   * @nocheckin
   */
  tenantId?: number;
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
}
/**
 * The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed.
 *
 * This interface was referenced by `SourcebotConfigurationSchema`'s JSON-Schema
 * via the `definition` "GitRevisions".
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
/**
 * This interface was referenced by `SourcebotConfigurationSchema`'s JSON-Schema
 * via the `definition` "GitLabConfig".
 */
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
 * This interface was referenced by `SourcebotConfigurationSchema`'s JSON-Schema
 * via the `definition` "GiteaConfig".
 */
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
     * List of individual repositories to exclude from syncing. Glob patterns are supported.
     */
    repos?: string[];
  };
  revisions?: GitRevisions;
}
/**
 * This interface was referenced by `SourcebotConfigurationSchema`'s JSON-Schema
 * via the `definition` "GerritConfig".
 */
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
   * List of specific projects to sync. If not specified, all projects will be synced. Glob patterns are supported
   */
  projects?: string[];
  exclude?: {
    /**
     * List of specific projects to exclude from syncing.
     */
    projects?: string[];
  };
}
/**
 * This interface was referenced by `SourcebotConfigurationSchema`'s JSON-Schema
 * via the `definition` "LocalConfig".
 */
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
     * List of paths relative to the provided `path` to exclude from the index. .git, .hg, and .svn are always exluded.
     */
    paths?: string[];
  };
}
/**
 * This interface was referenced by `SourcebotConfigurationSchema`'s JSON-Schema
 * via the `definition` "GitConfig".
 */
export interface GitConfig {
  /**
   * Git Configuration
   */
  type: "git";
  /**
   * The URL to the git repository.
   */
  url: string;
  revisions?: GitRevisions;
}
