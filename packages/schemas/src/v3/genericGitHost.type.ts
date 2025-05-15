// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface GenericGitHostConnectionConfig {
  /**
   * Generic Git host configuration
   */
  type: "git";
  /**
   * The URL to the git repository. This can either be a remote URL (prefixed with `http://` or `https://`) or a absolute path to a directory on the local machine (prefixed with `file://`). If a local directory is specified, it must point to the root of a git repository. Local directories are treated as read-only modified. Local directories support glob patterns.
   */
  url: string;
  revisions?: GitRevisions;
}
/**
 * The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed. A maximum of 64 revisions can be indexed, with any additional revisions being ignored.
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
