// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto


/**
 * Branch limits search to a specific branch.
 */
export interface Branch {
  'pattern'?: (string);
  /**
   * exact is true if we want to Pattern to equal branch.
   */
  'exact'?: (boolean);
}

/**
 * Branch limits search to a specific branch.
 */
export interface Branch__Output {
  'pattern': (string);
  /**
   * exact is true if we want to Pattern to equal branch.
   */
  'exact': (boolean);
}
