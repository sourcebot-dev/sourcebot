// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export type Repos = GitHubConfig | GitLabConfig | GiteaConfig;

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
     * Exlcude forked repositories from syncing.
     */
    forks?: boolean;
    /**
     * Exlcude archived repositories from syncing.
     */
    archived?: boolean;
    /**
     * List of individual repositories to exclude from syncing. Expected to be formatted as '{orgName}/{repoName}' or '{userName}/{repoName}'.
     */
    repos?: string[];
  };
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
   * List of users to sync with. All personal projects that the user owns will be synced, unless explicitly defined in the `exclude` property.
   */
  users?: string[];
  /**
   * List of groups to sync with. All projects in the group visible to the provided `token` (if any) will be synced, unless explicitly defined in the `exclude` property. Subgroups can be specified by providing the path to the subgroup (e.g. `my-group/sub-group-a`).
   */
  groups?: string[];
  /**
   * List of individual projects to sync with. The project's namespace must be specified. See: https://docs.gitlab.com/ee/user/namespace/
   */
  projects?: string[];
  exclude?: {
    /**
     * Exlcude forked projects from syncing.
     */
    forks?: boolean;
    /**
     * Exlcude archived projects from syncing.
     */
    archived?: boolean;
    /**
     * List of individual projects to exclude from syncing. The project's namespace must be specified. See: https://docs.gitlab.com/ee/user/namespace/
     */
    projects?: string[];
  };
}
export interface GiteaConfig {
  /**
   * Gitea Configuration
   */
  type: "gitea";
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
   * The URL of the Gitea host. Defaults to https://gitea.com
   */
  url?: string;
  /**
   * List of organizations to sync with. All repositories in the organization visible to the provided `token` (if any) will be synced, unless explicitly defined in the `exclude` property.
   */
  orgs?: string[];
}
