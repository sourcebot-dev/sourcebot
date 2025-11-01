// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface AzureDevOpsConnectionConfig {
  /**
   * Azure DevOps Configuration
   */
  type: "azuredevops";
  /**
   * A Personal Access Token (PAT).
   */
  token:
    | {
        /**
         * The name of the environment variable that contains the token.
         */
        env: string;
      }
    | {
        /**
         * The name of the GCP secret that contains the token.
         */
        gcpSecretName: string;
      };
  /**
   * The URL of the Azure DevOps host. For Azure DevOps Cloud, use https://dev.azure.com. For Azure DevOps Server, use your server URL.
   */
  url?: string;
  /**
   * The type of Azure DevOps deployment
   */
  deploymentType: "cloud" | "server";
  /**
   * Use legacy TFS path format (/tfs) in API URLs. Required for older TFS installations (TFS 2018 and earlier). When true, API URLs will include /tfs in the path (e.g., https://server/tfs/collection/_apis/...).
   */
  useTfsPath?: boolean;
  /**
   * List of organizations to sync with. For Cloud, this is the organization name. For Server, this is the collection name. All projects and repositories visible to the provided `token` will be synced, unless explicitly defined in the `exclude` property.
   */
  orgs?: string[];
  /**
   * List of specific projects to sync with. Expected to be formatted as '{orgName}/{projectName}' for Cloud or '{collectionName}/{projectName}' for Server.
   */
  projects?: string[];
  /**
   * List of individual repositories to sync with. Expected to be formatted as '{orgName}/{projectName}/{repoName}'.
   */
  repos?: string[];
  exclude?: {
    /**
     * Exclude disabled repositories from syncing.
     */
    disabled?: boolean;
    /**
     * List of repositories to exclude from syncing. Glob patterns are supported.
     */
    repos?: string[];
    /**
     * List of projects to exclude from syncing. Glob patterns are supported.
     */
    projects?: string[];
    /**
     * Exclude repositories based on their size.
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
