// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { Q as _zoekt_webserver_v1_Q, Q__Output as _zoekt_webserver_v1_Q__Output } from '../../../zoekt/webserver/v1/Q';
import type { SearchOptions as _zoekt_webserver_v1_SearchOptions, SearchOptions__Output as _zoekt_webserver_v1_SearchOptions__Output } from '../../../zoekt/webserver/v1/SearchOptions';

export interface SearchRequest {
  'query'?: (_zoekt_webserver_v1_Q | null);
  'opts'?: (_zoekt_webserver_v1_SearchOptions | null);
}

export interface SearchRequest__Output {
  'query': (_zoekt_webserver_v1_Q__Output | null);
  'opts': (_zoekt_webserver_v1_SearchOptions__Output | null);
}
