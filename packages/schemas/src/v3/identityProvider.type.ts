// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export type IdentityProviderConfig =
  | GitHubIdentityProviderConfig
  | GitLabIdentityProviderConfig
  | GoogleIdentityProviderConfig
  | OktaIdentityProviderConfig
  | KeycloakIdentityProviderConfig
  | MicrosoftEntraIDIdentityProviderConfig
  | GCPIAPIdentityProviderConfig;

export interface GitHubIdentityProviderConfig {
  provider: "github";
  purpose: "sso" | "integration";
  clientId: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  clientSecret: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  baseUrl?: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  required?: boolean;
  [k: string]: unknown;
}
export interface GitLabIdentityProviderConfig {
  provider: "gitlab";
  purpose: "sso" | "integration";
  clientId: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  clientSecret: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  baseUrl: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  required?: boolean;
  [k: string]: unknown;
}
export interface GoogleIdentityProviderConfig {
  provider: "google";
  clientId: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  clientSecret: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  [k: string]: unknown;
}
export interface OktaIdentityProviderConfig {
  provider: "okta";
  clientId: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  clientSecret: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  issuer: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  [k: string]: unknown;
}
export interface KeycloakIdentityProviderConfig {
  provider: "keycloak";
  clientId: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  clientSecret: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  issuer: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  [k: string]: unknown;
}
export interface MicrosoftEntraIDIdentityProviderConfig {
  provider: "microsoft-entra-id";
  clientId: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  clientSecret: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  issuer: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  [k: string]: unknown;
}
export interface GCPIAPIdentityProviderConfig {
  provider: "gcp-iap";
  audience: {
    /**
     * The name of the environment variable that contains the token. Only supported in declarative connection configs.
     */
    env: string;
  };
  [k: string]: unknown;
}
