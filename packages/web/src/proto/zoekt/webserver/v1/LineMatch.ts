// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { LineFragmentMatch as _zoekt_webserver_v1_LineFragmentMatch, LineFragmentMatch__Output as _zoekt_webserver_v1_LineFragmentMatch__Output } from '../../../zoekt/webserver/v1/LineFragmentMatch';
import type { Long } from '@grpc/proto-loader';

export interface LineMatch {
  'line'?: (Buffer | Uint8Array | string);
  'line_start'?: (number | string | Long);
  'line_end'?: (number | string | Long);
  'line_number'?: (number | string | Long);
  /**
   * before and after are only set when SearchOptions.NumContextLines is > 0
   */
  'before'?: (Buffer | Uint8Array | string);
  'after'?: (Buffer | Uint8Array | string);
  /**
   * If set, this was a match on the filename.
   */
  'file_name'?: (boolean);
  /**
   * The higher the better. Only ranks the quality of the match
   * within the file, does not take rank of file into account
   */
  'score'?: (number | string);
  'debug_score'?: (string);
  'line_fragments'?: (_zoekt_webserver_v1_LineFragmentMatch)[];
}

export interface LineMatch__Output {
  'line': (Buffer);
  'line_start': (number);
  'line_end': (number);
  'line_number': (number);
  /**
   * before and after are only set when SearchOptions.NumContextLines is > 0
   */
  'before': (Buffer);
  'after': (Buffer);
  /**
   * If set, this was a match on the filename.
   */
  'file_name': (boolean);
  /**
   * The higher the better. Only ranks the quality of the match
   * within the file, does not take rank of file into account
   */
  'score': (number);
  'debug_score': (string);
  'line_fragments': (_zoekt_webserver_v1_LineFragmentMatch__Output)[];
}
