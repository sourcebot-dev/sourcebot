// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export type AppConfig = GitHubAppConfig;

export interface GitHubAppConfig {
  /**
   * GitHub App Configuration
   */
  type: "github";
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
  privateKey:
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
}
