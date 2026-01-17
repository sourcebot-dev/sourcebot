// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto


export interface Location {
  /**
   * 0-based byte offset from the beginning of the file
   */
  'byte_offset'?: (number);
  /**
   * 1-based line number from the beginning of the file
   */
  'line_number'?: (number);
  /**
   * 1-based column number (in runes) from the beginning of line
   */
  'column'?: (number);
}

export interface Location__Output {
  /**
   * 0-based byte offset from the beginning of the file
   */
  'byte_offset': (number);
  /**
   * 1-based line number from the beginning of the file
   */
  'line_number': (number);
  /**
   * 1-based column number (in runes) from the beginning of line
   */
  'column': (number);
}
