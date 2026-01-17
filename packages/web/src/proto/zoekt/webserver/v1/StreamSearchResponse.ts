// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { SearchResponse as _zoekt_webserver_v1_SearchResponse, SearchResponse__Output as _zoekt_webserver_v1_SearchResponse__Output } from '../../../zoekt/webserver/v1/SearchResponse';

export interface StreamSearchResponse {
  'response_chunk'?: (_zoekt_webserver_v1_SearchResponse | null);
}

export interface StreamSearchResponse__Output {
  'response_chunk': (_zoekt_webserver_v1_SearchResponse__Output | null);
}
