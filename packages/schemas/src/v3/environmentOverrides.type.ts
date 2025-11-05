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
