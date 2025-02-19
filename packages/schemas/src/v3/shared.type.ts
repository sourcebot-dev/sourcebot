// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface Shared {
  [k: string]: unknown;
}
/**
 * This interface was referenced by `Shared`'s JSON-Schema
 * via the `definition` "Token".
 */
export interface Token {
  /**
   * The name of the secret that contains the token.
   */
  secret: string;
}
/**
 * The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed.
 *
 * This interface was referenced by `Shared`'s JSON-Schema
 * via the `definition` "GitRevisions".
 */
export interface GitRevisions {
  /**
   * List of branches to include when indexing. For a given repo, only the branches that exist on the repo's remote *and* match at least one of the provided `branches` will be indexed. The default branch (HEAD) is always indexed. Glob patterns are supported.
   */
  branches?: string[];
  /**
   * List of tags to include when indexing. For a given repo, only the tags that exist on the repo's remote *and* match at least one of the provided `tags` will be indexed. Glob patterns are supported.
   */
  tags?: string[];
}
