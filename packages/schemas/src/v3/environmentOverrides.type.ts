// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

/**
 * Environment variable overrides.
 */
export interface EnvironmentOverrides {
  /**
   * This interface was referenced by `EnvironmentOverrides`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9_-]+$".
   */
  [k: string]:
    | {
        type: "token";
        value:
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
            }
          | {
              /**
               * The path to a file that contains the token. The file is re-read each time the token is used, so its contents can be rotated without restarting Sourcebot (e.g., a mounted Kubernetes secret).
               */
              file: string;
            }
          | {
              /**
               * The identifier of an Azure Key Vault secret. Must be in the format `https://<vault-name>.vault.azure.net/secrets/<secret-name>` or `https://<vault-name>.vault.azure.net/secrets/<secret-name>/<version>`. If the version is omitted, the latest version is used. Authenticates using DefaultAzureCredential. See https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets
               */
              azureKeyVaultSecret: string;
            };
      }
    | {
        type: "string";
        value: string;
      }
    | {
        type: "number";
        value: number;
      }
    | {
        type: "boolean";
        value: boolean;
      };
}
