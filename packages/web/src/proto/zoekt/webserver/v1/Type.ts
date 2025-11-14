// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto

import type { Q as _zoekt_webserver_v1_Q, Q__Output as _zoekt_webserver_v1_Q__Output } from '../../../zoekt/webserver/v1/Q';

// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto

export const _zoekt_webserver_v1_Type_Kind = {
  KIND_UNKNOWN_UNSPECIFIED: 'KIND_UNKNOWN_UNSPECIFIED',
  KIND_FILE_MATCH: 'KIND_FILE_MATCH',
  KIND_FILE_NAME: 'KIND_FILE_NAME',
  KIND_REPO: 'KIND_REPO',
} as const;

export type _zoekt_webserver_v1_Type_Kind =
  | 'KIND_UNKNOWN_UNSPECIFIED'
  | 0
  | 'KIND_FILE_MATCH'
  | 1
  | 'KIND_FILE_NAME'
  | 2
  | 'KIND_REPO'
  | 3

export type _zoekt_webserver_v1_Type_Kind__Output = typeof _zoekt_webserver_v1_Type_Kind[keyof typeof _zoekt_webserver_v1_Type_Kind]

/**
 * Type changes the result type returned.
 */
export interface Type {
  'child'?: (_zoekt_webserver_v1_Q | null);
  /**
   * TODO: type constants
   */
  'type'?: (_zoekt_webserver_v1_Type_Kind);
}

/**
 * Type changes the result type returned.
 */
export interface Type__Output {
  'child': (_zoekt_webserver_v1_Q__Output | null);
  /**
   * TODO: type constants
   */
  'type': (_zoekt_webserver_v1_Type_Kind__Output);
}
