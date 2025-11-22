// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { Long } from '@grpc/proto-loader';

export interface IndexMetadata {
  'index_format_version'?: (number | string | Long);
  'index_feature_version'?: (number | string | Long);
  'index_min_reader_version'?: (number | string | Long);
  'index_time'?: (_google_protobuf_Timestamp | null);
  'plain_ascii'?: (boolean);
  'language_map'?: ({[key: string]: number});
  'zoekt_version'?: (string);
  'id'?: (string);
}

export interface IndexMetadata__Output {
  'index_format_version': (number);
  'index_feature_version': (number);
  'index_min_reader_version': (number);
  'index_time': (_google_protobuf_Timestamp__Output | null);
  'plain_ascii': (boolean);
  'language_map': ({[key: string]: number});
  'zoekt_version': (string);
  'id': (string);
}
