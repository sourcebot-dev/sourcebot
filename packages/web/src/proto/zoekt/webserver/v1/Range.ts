// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { Location as _zoekt_webserver_v1_Location, Location__Output as _zoekt_webserver_v1_Location__Output } from '../../../zoekt/webserver/v1/Location';

export interface Range {
  /**
   * The inclusive beginning of the range.
   */
  'start'?: (_zoekt_webserver_v1_Location | null);
  /**
   * The exclusive end of the range.
   */
  'end'?: (_zoekt_webserver_v1_Location | null);
}

export interface Range__Output {
  /**
   * The inclusive beginning of the range.
   */
  'start': (_zoekt_webserver_v1_Location__Output | null);
  /**
   * The exclusive end of the range.
   */
  'end': (_zoekt_webserver_v1_Location__Output | null);
}
