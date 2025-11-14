// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto

import type { Q as _zoekt_webserver_v1_Q, Q__Output as _zoekt_webserver_v1_Q__Output } from '../../../zoekt/webserver/v1/Q';

/**
 * And is matched when all its children are.
 */
export interface And {
  'children'?: (_zoekt_webserver_v1_Q)[];
}

/**
 * And is matched when all its children are.
 */
export interface And__Output {
  'children': (_zoekt_webserver_v1_Q__Output)[];
}
