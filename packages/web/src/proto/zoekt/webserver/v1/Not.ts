// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto

import type { Q as _zoekt_webserver_v1_Q, Q__Output as _zoekt_webserver_v1_Q__Output } from '../../../zoekt/webserver/v1/Q';

/**
 * Not inverts the meaning of its child.
 */
export interface Not {
  'child'?: (_zoekt_webserver_v1_Q | null);
}

/**
 * Not inverts the meaning of its child.
 */
export interface Not__Output {
  'child': (_zoekt_webserver_v1_Q__Output | null);
}
