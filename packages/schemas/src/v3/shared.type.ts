// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

/**
 * This interface was referenced by `Shared`'s JSON-Schema
 * via the `definition` "Token".
 */
export type Token =
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

export interface Shared {
  [k: string]: unknown;
}
/**
 * The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed. A maximum of 64 revisions can be indexed, with any additional revisions being ignored.
 *
 * This interface was referenced by `Shared`'s JSON-Schema
 * via the `definition` "GitRevisions".
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
/**
 * Optional headers to use with the model.
 *
 * This interface was referenced by `Shared`'s JSON-Schema
 * via the `definition` "LanguageModelHeaders".
 */
export interface LanguageModelHeaders {
  /**
   * This interface was referenced by `LanguageModelHeaders`'s JSON-Schema definition
   * via the `patternProperty` "^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$".
   */
  [k: string]: string | Token;
}
/**
 * Optional query parameters to include in the request url.
 *
 * This interface was referenced by `Shared`'s JSON-Schema
 * via the `definition` "LanguageModelQueryParams".
 */
export interface LanguageModelQueryParams {
  /**
   * This interface was referenced by `LanguageModelQueryParams`'s JSON-Schema definition
   * via the `patternProperty` "^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$".
   */
  [k: string]: string | Token;
}
/**
 * Optional retry policy for inference requests made with this model. When unset, defaults apply (3 retries with exponential backoff starting at 500ms).
 *
 * This interface was referenced by `Shared`'s JSON-Schema
 * via the `definition` "LanguageModelRetry".
 */
export interface LanguageModelRetry {
  /**
   * Maximum number of retry attempts for a failed inference request. Only transient failures (network errors, 408/429/5xx responses) are retried. Set to 0 to disable retries. Defaults to 3.
   */
  maxRetries?: number;
  /**
   * Delay in milliseconds before the first retry. Doubles after each attempt, up to maxBackoffMs. Defaults to 500.
   */
  initialBackoffMs?: number;
  /**
   * Maximum delay in milliseconds between retries. Defaults to 8000.
   */
  maxBackoffMs?: number;
}
/**
 * Reference to another configured language model to use as a fallback when blocking Ask requests (the MCP ask_codebase tool and the blocking chat API) with this model keep failing after retries.
 *
 * This interface was referenced by `Shared`'s JSON-Schema
 * via the `definition` "LanguageModelFallbackReference".
 */
export interface LanguageModelFallbackReference {
  /**
   * The provider of the fallback language model. Must match the provider of another entry in `models`.
   */
  provider:
    | "amazon-bedrock"
    | "anthropic"
    | "azure"
    | "deepseek"
    | "google-generative-ai"
    | "google-vertex-anthropic"
    | "google-vertex"
    | "mistral"
    | "openai"
    | "openai-compatible"
    | "openrouter"
    | "xai";
  /**
   * The name of the fallback language model. Must match the `model` of another entry in `models` with the same provider.
   */
  model: string;
  /**
   * Optional display name. When set, the fallback matches the configured model with the same provider, model and display name.
   */
  displayName?: string;
}
