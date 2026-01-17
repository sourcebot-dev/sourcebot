// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { ListRequest as _zoekt_webserver_v1_ListRequest, ListRequest__Output as _zoekt_webserver_v1_ListRequest__Output } from '../../../zoekt/webserver/v1/ListRequest';
import type { ListResponse as _zoekt_webserver_v1_ListResponse, ListResponse__Output as _zoekt_webserver_v1_ListResponse__Output } from '../../../zoekt/webserver/v1/ListResponse';
import type { SearchRequest as _zoekt_webserver_v1_SearchRequest, SearchRequest__Output as _zoekt_webserver_v1_SearchRequest__Output } from '../../../zoekt/webserver/v1/SearchRequest';
import type { SearchResponse as _zoekt_webserver_v1_SearchResponse, SearchResponse__Output as _zoekt_webserver_v1_SearchResponse__Output } from '../../../zoekt/webserver/v1/SearchResponse';
import type { StreamSearchRequest as _zoekt_webserver_v1_StreamSearchRequest, StreamSearchRequest__Output as _zoekt_webserver_v1_StreamSearchRequest__Output } from '../../../zoekt/webserver/v1/StreamSearchRequest';
import type { StreamSearchResponse as _zoekt_webserver_v1_StreamSearchResponse, StreamSearchResponse__Output as _zoekt_webserver_v1_StreamSearchResponse__Output } from '../../../zoekt/webserver/v1/StreamSearchResponse';

export interface WebserverServiceClient extends grpc.Client {
  /**
   * List lists repositories. The query `q` can only contain
   * query.Repo atoms.
   */
  List(argument: _zoekt_webserver_v1_ListRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_zoekt_webserver_v1_ListResponse__Output>): grpc.ClientUnaryCall;
  List(argument: _zoekt_webserver_v1_ListRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_zoekt_webserver_v1_ListResponse__Output>): grpc.ClientUnaryCall;
  List(argument: _zoekt_webserver_v1_ListRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_zoekt_webserver_v1_ListResponse__Output>): grpc.ClientUnaryCall;
  List(argument: _zoekt_webserver_v1_ListRequest, callback: grpc.requestCallback<_zoekt_webserver_v1_ListResponse__Output>): grpc.ClientUnaryCall;
  /**
   * List lists repositories. The query `q` can only contain
   * query.Repo atoms.
   */
  list(argument: _zoekt_webserver_v1_ListRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_zoekt_webserver_v1_ListResponse__Output>): grpc.ClientUnaryCall;
  list(argument: _zoekt_webserver_v1_ListRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_zoekt_webserver_v1_ListResponse__Output>): grpc.ClientUnaryCall;
  list(argument: _zoekt_webserver_v1_ListRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_zoekt_webserver_v1_ListResponse__Output>): grpc.ClientUnaryCall;
  list(argument: _zoekt_webserver_v1_ListRequest, callback: grpc.requestCallback<_zoekt_webserver_v1_ListResponse__Output>): grpc.ClientUnaryCall;
  
  Search(argument: _zoekt_webserver_v1_SearchRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_zoekt_webserver_v1_SearchResponse__Output>): grpc.ClientUnaryCall;
  Search(argument: _zoekt_webserver_v1_SearchRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_zoekt_webserver_v1_SearchResponse__Output>): grpc.ClientUnaryCall;
  Search(argument: _zoekt_webserver_v1_SearchRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_zoekt_webserver_v1_SearchResponse__Output>): grpc.ClientUnaryCall;
  Search(argument: _zoekt_webserver_v1_SearchRequest, callback: grpc.requestCallback<_zoekt_webserver_v1_SearchResponse__Output>): grpc.ClientUnaryCall;
  search(argument: _zoekt_webserver_v1_SearchRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_zoekt_webserver_v1_SearchResponse__Output>): grpc.ClientUnaryCall;
  search(argument: _zoekt_webserver_v1_SearchRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_zoekt_webserver_v1_SearchResponse__Output>): grpc.ClientUnaryCall;
  search(argument: _zoekt_webserver_v1_SearchRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_zoekt_webserver_v1_SearchResponse__Output>): grpc.ClientUnaryCall;
  search(argument: _zoekt_webserver_v1_SearchRequest, callback: grpc.requestCallback<_zoekt_webserver_v1_SearchResponse__Output>): grpc.ClientUnaryCall;
  
  StreamSearch(argument: _zoekt_webserver_v1_StreamSearchRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_zoekt_webserver_v1_StreamSearchResponse__Output>;
  StreamSearch(argument: _zoekt_webserver_v1_StreamSearchRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_zoekt_webserver_v1_StreamSearchResponse__Output>;
  streamSearch(argument: _zoekt_webserver_v1_StreamSearchRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_zoekt_webserver_v1_StreamSearchResponse__Output>;
  streamSearch(argument: _zoekt_webserver_v1_StreamSearchRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_zoekt_webserver_v1_StreamSearchResponse__Output>;
  
}

export interface WebserverServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * List lists repositories. The query `q` can only contain
   * query.Repo atoms.
   */
  List: grpc.handleUnaryCall<_zoekt_webserver_v1_ListRequest__Output, _zoekt_webserver_v1_ListResponse>;
  
  Search: grpc.handleUnaryCall<_zoekt_webserver_v1_SearchRequest__Output, _zoekt_webserver_v1_SearchResponse>;
  
  StreamSearch: grpc.handleServerStreamingCall<_zoekt_webserver_v1_StreamSearchRequest__Output, _zoekt_webserver_v1_StreamSearchResponse>;
  
}

export interface WebserverServiceDefinition extends grpc.ServiceDefinition {
  List: MethodDefinition<_zoekt_webserver_v1_ListRequest, _zoekt_webserver_v1_ListResponse, _zoekt_webserver_v1_ListRequest__Output, _zoekt_webserver_v1_ListResponse__Output>
  Search: MethodDefinition<_zoekt_webserver_v1_SearchRequest, _zoekt_webserver_v1_SearchResponse, _zoekt_webserver_v1_SearchRequest__Output, _zoekt_webserver_v1_SearchResponse__Output>
  StreamSearch: MethodDefinition<_zoekt_webserver_v1_StreamSearchRequest, _zoekt_webserver_v1_StreamSearchResponse, _zoekt_webserver_v1_StreamSearchRequest__Output, _zoekt_webserver_v1_StreamSearchResponse__Output>
}
