// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto


/**
 * BranchRepos is a (branch, sourcegraph repo ids bitmap) tuple. It is a
 * Sourcegraph addition.
 */
export interface BranchRepos {
  'branch'?: (string);
  /**
   * a serialized roaring bitmap of the target repo ids
   */
  'repos'?: (Buffer | Uint8Array | string);
}

/**
 * BranchRepos is a (branch, sourcegraph repo ids bitmap) tuple. It is a
 * Sourcegraph addition.
 */
export interface BranchRepos__Output {
  'branch': (string);
  /**
   * a serialized roaring bitmap of the target repo ids
   */
  'repos': (Buffer);
}
