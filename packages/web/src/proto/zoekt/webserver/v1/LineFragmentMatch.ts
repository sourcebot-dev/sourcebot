// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { SymbolInfo as _zoekt_webserver_v1_SymbolInfo, SymbolInfo__Output as _zoekt_webserver_v1_SymbolInfo__Output } from '../../../zoekt/webserver/v1/SymbolInfo';
import type { Long } from '@grpc/proto-loader';

export interface LineFragmentMatch {
  /**
   * Offset within the line, in bytes.
   */
  'line_offset'?: (number | string | Long);
  /**
   * Offset from file start, in bytes.
   */
  'offset'?: (number);
  /**
   * Number bytes that match.
   */
  'match_length'?: (number | string | Long);
  'symbol_info'?: (_zoekt_webserver_v1_SymbolInfo | null);
  '_symbol_info'?: "symbol_info";
}

export interface LineFragmentMatch__Output {
  /**
   * Offset within the line, in bytes.
   */
  'line_offset': (number);
  /**
   * Offset from file start, in bytes.
   */
  'offset': (number);
  /**
   * Number bytes that match.
   */
  'match_length': (number);
  'symbol_info'?: (_zoekt_webserver_v1_SymbolInfo__Output | null);
  '_symbol_info'?: "symbol_info";
}
