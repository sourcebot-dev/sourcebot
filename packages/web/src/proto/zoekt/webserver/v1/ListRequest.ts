// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { Q as _zoekt_webserver_v1_Q, Q__Output as _zoekt_webserver_v1_Q__Output } from '../../../zoekt/webserver/v1/Q';
import type { ListOptions as _zoekt_webserver_v1_ListOptions, ListOptions__Output as _zoekt_webserver_v1_ListOptions__Output } from '../../../zoekt/webserver/v1/ListOptions';

export interface ListRequest {
  'query'?: (_zoekt_webserver_v1_Q | null);
  'opts'?: (_zoekt_webserver_v1_ListOptions | null);
}

export interface ListRequest__Output {
  'query': (_zoekt_webserver_v1_Q__Output | null);
  'opts': (_zoekt_webserver_v1_ListOptions__Output | null);
}
