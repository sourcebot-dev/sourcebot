// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export type AppConfig = GitHubAppConfig;

export interface GitHubAppConfig {
  /**
   * GitHub App Configuration
   */
  type: "githubApp";
  /**
   * The hostname of the GitHub App deployment.
   */
  deploymentHostname?: string;
  /**
   * The ID of the GitHub App.
   */
  id: string;
  /**
   * The private key of the GitHub App.
   */
  privateKey: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
}
