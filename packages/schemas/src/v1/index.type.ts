// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

/**
 * This interface was referenced by `Index`'s JSON-Schema
 * via the `definition` "ZoektConfig".
 */
export type ZoektConfig = GitHubConfig | GitLabConfig;
/**
 * Only clone repos whose name matches the given regexp.
 *
 * This interface was referenced by `Index`'s JSON-Schema
 * via the `definition` "RepoNameRegexIncludeFilter".
 */
export type RepoNameRegexIncludeFilter = string;
/**
 * Don't mirror repos whose names match this regexp.
 *
 * This interface was referenced by `Index`'s JSON-Schema
 * via the `definition` "RepoNameRegexExcludeFilter".
 */
export type RepoNameRegexExcludeFilter = string;

export interface Index {
  $schema?: string;
  Configs: ZoektConfig[];
}
/**
 * This interface was referenced by `Index`'s JSON-Schema
 * via the `definition` "GitHubConfig".
 */
export interface GitHubConfig {
  Type: "github";
  /**
   * GitHub Enterprise url. If not set github.com will be used as the host.
   */
  GitHubUrl?: string;
  /**
   * The GitHub user to mirror
   */
  GitHubUser?: string;
  /**
   * The GitHub organization to mirror
   */
  GitHubOrg?: string;
  Name?: RepoNameRegexIncludeFilter;
  Exclude?: RepoNameRegexExcludeFilter;
  /**
   * Path to a file containing a GitHub access token.
   */
  CredentialPath?: string;
  /**
   * Only mirror repos that have one of the given topics
   */
  Topics?: string[];
  /**
   * Don't mirror repos that have one of the given topics
   */
  ExcludeTopics?: string[];
  /**
   * Mirror repos that are _not_ archived
   */
  NoArchived?: boolean;
  /**
   * Also mirror forks
   */
  IncludeForks?: boolean;
}
/**
 * This interface was referenced by `Index`'s JSON-Schema
 * via the `definition` "GitLabConfig".
 */
export interface GitLabConfig {
  Type: "gitlab";
  /**
   * The GitLab API url.
   */
  GitLabURL?: string;
  Name?: RepoNameRegexIncludeFilter;
  Exclude?: RepoNameRegexExcludeFilter;
  /**
   * Only mirror public repos
   */
  OnlyPublic?: boolean;
  /**
   * Path to a file containing a GitLab access token.
   */
  CredentialPath?: string;
}
