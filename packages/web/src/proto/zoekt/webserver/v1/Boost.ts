// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto

import type { Q as _zoekt_webserver_v1_Q, Q__Output as _zoekt_webserver_v1_Q__Output } from '../../../zoekt/webserver/v1/Q';

/**
 * Boost multiplies the score of its child by the boost factor.
 */
export interface Boost {
  'child'?: (_zoekt_webserver_v1_Q | null);
  'boost'?: (number | string);
}

/**
 * Boost multiplies the score of its child by the boost factor.
 */
export interface Boost__Output {
  'child': (_zoekt_webserver_v1_Q__Output | null);
  'boost': (number);
}
