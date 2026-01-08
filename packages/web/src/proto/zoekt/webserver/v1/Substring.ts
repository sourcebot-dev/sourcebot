// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto


export interface Substring {
  'pattern'?: (string);
  'case_sensitive'?: (boolean);
  /**
   * Match only filename
   */
  'file_name'?: (boolean);
  /**
   * Match only content
   */
  'content'?: (boolean);
}

export interface Substring__Output {
  'pattern': (string);
  'case_sensitive': (boolean);
  /**
   * Match only filename
   */
  'file_name': (boolean);
  /**
   * Match only content
   */
  'content': (boolean);
}
