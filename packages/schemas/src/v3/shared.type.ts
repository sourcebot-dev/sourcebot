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
 * The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed first. Sourcebot can index at most 64 total revisions per repository, including the default branch. Matching branches are considered before matching tags, and any revisions beyond the 64 revision limit are ignored.
 *
 * This interface was referenced by `Shared`'s JSON-Schema
 * via the `definition` "GitRevisions".
 */
export interface GitRevisions {
  /**
   * List of branches to include when indexing. For a given repo, only the branches that exist on the repo's remote *and* match at least one of the provided `branches` will be indexed. The default branch (HEAD) is always indexed. Glob patterns are supported. Matching branches are considered before matching tags, and the combined default branch, branch, and tag revision list is capped at 64 total revisions.
   */
  branches?: string[];
  /**
   * Sort order to use when listing candidate branches before matching branch glob patterns and applying the global 64 revision limit. Values map to Git `for-each-ref` sort keys. `committerdate` and `creatordate` sort newest-first, while `refname` sorts lexicographically by ref name. For branches, `creatordate` follows Git object creator-date semantics and is not a branch creation timestamp.
   */
  branchSort?: "committerdate" | "creatordate" | "refname";
  /**
   * List of tags to include when indexing. For a given repo, only the tags that exist on the repo's remote *and* match at least one of the provided `tags` will be indexed. Glob patterns are supported. Matching tags are considered after matching branches, and the combined default branch, branch, and tag revision list is capped at 64 total revisions.
   */
  tags?: string[];
  /**
   * Sort order to use when listing candidate tags before matching tag glob patterns and applying the global 64 revision limit. Values map to Git `for-each-ref` sort keys. `committerdate` and `creatordate` sort newest-first, while `refname` sorts lexicographically by ref name.
   */
  tagSort?: "committerdate" | "creatordate" | "refname";
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
