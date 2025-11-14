// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto

import type { Q as _zoekt_webserver_v1_Q, Q__Output as _zoekt_webserver_v1_Q__Output } from '../../../zoekt/webserver/v1/Q';

/**
 * Or is matched when any of its children is matched.
 */
export interface Or {
  'children'?: (_zoekt_webserver_v1_Q)[];
}

/**
 * Or is matched when any of its children is matched.
 */
export interface Or__Output {
  'children': (_zoekt_webserver_v1_Q__Output)[];
}
