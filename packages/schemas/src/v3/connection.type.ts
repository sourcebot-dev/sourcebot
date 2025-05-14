// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export type ConnectionConfig =
  | GithubConnectionConfig
  | GitlabConnectionConfig
  | GiteaConnectionConfig
  | GerritConnectionConfig
  | BitbucketConnectionConfig
  | GenericGitHostConnectionConfig;

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
export interface GitlabConnectionConfig {
  /**
   * GitLab Configuration
   */
  type: "gitlab";
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
export interface GiteaConnectionConfig {
  /**
   * Gitea Configuration
   */
  type: "gitea";
  /**
   * A Personal Access Token (PAT).
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
}
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
export interface GenericGitHostConnectionConfig {
  /**
   * Generic Git host configuration
   */
  type: "git";
  /**
   * The URL to the git repository. This can either be a remote URL (prefixed with `http://` or `https://`) or a absolute path to a directory on the local machine (prefixed with `file://`). If a local directory is specified, it must point to the root of a git repository. Local directories are treated as read-only modified. Local directories support glob patterns.
   */
  url: string;
  revisions?: GitRevisions;
}
