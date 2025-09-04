// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

/**
 * This interface was referenced by `Shared`'s JSON-Schema
 * via the `definition` "Token".
 */
export type Token =
  | {
      /**
       * The name of the secret that contains the token.
       */
      secret: string;
    }
  | {
      /**
       * The name of the environment variable that contains the token. Only supported in declarative connection configs.
       */
      env: string;
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
 * Optional query parameters to use with the model.
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
