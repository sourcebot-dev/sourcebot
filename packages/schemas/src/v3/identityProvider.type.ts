// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export type IdentityProviderConfig =
  | GitHubIdentityProviderConfig
  | GitLabIdentityProviderConfig
  | GoogleIdentityProviderConfig
  | OktaIdentityProviderConfig
  | KeycloakIdentityProviderConfig
  | MicrosoftEntraIDIdentityProviderConfig
  | GCPIAPIdentityProviderConfig
  | AuthentikIdentityProviderConfig
  | BitbucketCloudIdentityProviderConfig
  | JumpCloudIdentityProviderConfig
  | BitbucketServerIdentityProviderConfig;

export interface GitHubIdentityProviderConfig {
  provider: "github";
  /**
   * Optional human-readable label shown on the login screen. Defaults to 'GitHub'.
   */
  displayName?: string;
  purpose: "sso" | "account_linking";
  clientId:
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
  clientSecret:
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
  /**
   * The URL of the GitHub host. Defaults to https://github.com
   */
  baseUrl?: string;
  accountLinkingRequired?: boolean;
}
export interface GitLabIdentityProviderConfig {
  provider: "gitlab";
  /**
   * Optional human-readable label shown on the login screen. Defaults to 'GitLab'.
   */
  displayName?: string;
  purpose: "sso" | "account_linking";
  clientId:
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
  clientSecret:
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
  /**
   * The URL of the GitLab host. Defaults to https://gitlab.com
   */
  baseUrl?: string;
  accountLinkingRequired?: boolean;
}
export interface GoogleIdentityProviderConfig {
  provider: "google";
  /**
   * Optional human-readable label shown on the login screen. Defaults to 'Google'.
   */
  displayName?: string;
  purpose: "sso";
  clientId:
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
  clientSecret:
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
export interface OktaIdentityProviderConfig {
  provider: "okta";
  /**
   * Optional human-readable label shown on the login screen. Defaults to 'Okta'.
   */
  displayName?: string;
  purpose: "sso";
  clientId:
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
  clientSecret:
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
  issuer:
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
export interface KeycloakIdentityProviderConfig {
  provider: "keycloak";
  /**
   * Optional human-readable label shown on the login screen. Defaults to 'Keycloak'.
   */
  displayName?: string;
  purpose: "sso";
  clientId:
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
  clientSecret:
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
  issuer:
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
export interface MicrosoftEntraIDIdentityProviderConfig {
  provider: "microsoft-entra-id";
  /**
   * Optional human-readable label shown on the login screen. Defaults to 'Microsoft Entra ID'.
   */
  displayName?: string;
  purpose: "sso";
  clientId:
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
  clientSecret:
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
  issuer:
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
export interface GCPIAPIdentityProviderConfig {
  provider: "gcp-iap";
  /**
   * Optional human-readable label shown on the login screen. Defaults to 'Google Cloud IAP'.
   */
  displayName?: string;
  purpose: "sso";
  audience:
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
export interface AuthentikIdentityProviderConfig {
  provider: "authentik";
  /**
   * Optional human-readable label shown on the login screen. Defaults to 'Authentik'.
   */
  displayName?: string;
  purpose: "sso";
  clientId:
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
  clientSecret:
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
  issuer:
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
export interface BitbucketCloudIdentityProviderConfig {
  provider: "bitbucket-cloud";
  /**
   * Optional human-readable label shown on the login screen and account settings. Defaults to 'Bitbucket Cloud'.
   */
  displayName?: string;
  purpose: "sso" | "account_linking";
  clientId:
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
  clientSecret:
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
  accountLinkingRequired?: boolean;
}
export interface JumpCloudIdentityProviderConfig {
  provider: "jumpcloud";
  /**
   * Optional human-readable label shown on the login screen. Defaults to 'JumpCloud'.
   */
  displayName?: string;
  purpose: "sso";
  clientId:
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
  clientSecret:
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
  issuer:
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
export interface BitbucketServerIdentityProviderConfig {
  provider: "bitbucket-server";
  /**
   * Optional human-readable label shown on the login screen and account settings. Defaults to 'Bitbucket Server'.
   */
  displayName?: string;
  purpose: "sso" | "account_linking";
  clientId:
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
  clientSecret:
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
  /**
   * The URL of the Bitbucket Server/Data Center host.
   */
  baseUrl: string;
  accountLinkingRequired?: boolean;
}
