// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto


/**
 * Similar to BranchRepos but will be used to match only by repoid and
 * therefore matches all branches
 */
export interface RepoIds {
  /**
   * a serialized roaring bitmap of the target repo ids
   */
  'repos'?: (Buffer | Uint8Array | string);
}

/**
 * Similar to BranchRepos but will be used to match only by repoid and
 * therefore matches all branches
 */
export interface RepoIds__Output {
  /**
   * a serialized roaring bitmap of the target repo ids
   */
  'repos': (Buffer);
}
