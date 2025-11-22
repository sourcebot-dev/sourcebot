// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { Location as _zoekt_webserver_v1_Location, Location__Output as _zoekt_webserver_v1_Location__Output } from '../../../zoekt/webserver/v1/Location';
import type { Range as _zoekt_webserver_v1_Range, Range__Output as _zoekt_webserver_v1_Range__Output } from '../../../zoekt/webserver/v1/Range';
import type { SymbolInfo as _zoekt_webserver_v1_SymbolInfo, SymbolInfo__Output as _zoekt_webserver_v1_SymbolInfo__Output } from '../../../zoekt/webserver/v1/SymbolInfo';

export interface ChunkMatch {
  /**
   * A contiguous range of complete lines that fully contains Ranges.
   */
  'content'?: (Buffer | Uint8Array | string);
  /**
   * The location (inclusive) of the beginning of content
   * relative to the beginning of the file. It will always be at the
   * beginning of a line (Column will always be 1).
   */
  'content_start'?: (_zoekt_webserver_v1_Location | null);
  /**
   * True if this match is a match on the file name, in
   * which case Content will contain the file name.
   */
  'file_name'?: (boolean);
  /**
   * A set of matching ranges within this chunk. Each range is relative
   * to the beginning of the file (not the beginning of Content).
   */
  'ranges'?: (_zoekt_webserver_v1_Range)[];
  /**
   * The symbol information associated with Ranges. If it is non-nil,
   * its length will equal that of Ranges. Any of its elements may be nil.
   */
  'symbol_info'?: (_zoekt_webserver_v1_SymbolInfo)[];
  'score'?: (number | string);
  'debug_score'?: (string);
  'best_line_match'?: (number);
}

export interface ChunkMatch__Output {
  /**
   * A contiguous range of complete lines that fully contains Ranges.
   */
  'content': (Buffer);
  /**
   * The location (inclusive) of the beginning of content
   * relative to the beginning of the file. It will always be at the
   * beginning of a line (Column will always be 1).
   */
  'content_start': (_zoekt_webserver_v1_Location__Output | null);
  /**
   * True if this match is a match on the file name, in
   * which case Content will contain the file name.
   */
  'file_name': (boolean);
  /**
   * A set of matching ranges within this chunk. Each range is relative
   * to the beginning of the file (not the beginning of Content).
   */
  'ranges': (_zoekt_webserver_v1_Range__Output)[];
  /**
   * The symbol information associated with Ranges. If it is non-nil,
   * its length will equal that of Ranges. Any of its elements may be nil.
   */
  'symbol_info': (_zoekt_webserver_v1_SymbolInfo__Output)[];
  'score': (number);
  'debug_score': (string);
  'best_line_match': (number);
}
