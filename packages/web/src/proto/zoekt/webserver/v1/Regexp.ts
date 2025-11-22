// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto


/**
 * Regexp is a query looking for regular expressions matches.
 */
export interface Regexp {
  'regexp'?: (string);
  'file_name'?: (boolean);
  'content'?: (boolean);
  'case_sensitive'?: (boolean);
}

/**
 * Regexp is a query looking for regular expressions matches.
 */
export interface Regexp__Output {
  'regexp': (string);
  'file_name': (boolean);
  'content': (boolean);
  'case_sensitive': (boolean);
}
