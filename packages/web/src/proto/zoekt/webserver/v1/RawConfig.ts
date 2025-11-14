// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto


// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto

export const _zoekt_webserver_v1_RawConfig_Flag = {
  FLAG_UNKNOWN_UNSPECIFIED: 'FLAG_UNKNOWN_UNSPECIFIED',
  FLAG_ONLY_PUBLIC: 'FLAG_ONLY_PUBLIC',
  FLAG_ONLY_PRIVATE: 'FLAG_ONLY_PRIVATE',
  FLAG_ONLY_FORKS: 'FLAG_ONLY_FORKS',
  FLAG_NO_FORKS: 'FLAG_NO_FORKS',
  FLAG_ONLY_ARCHIVED: 'FLAG_ONLY_ARCHIVED',
  FLAG_NO_ARCHIVED: 'FLAG_NO_ARCHIVED',
} as const;

export type _zoekt_webserver_v1_RawConfig_Flag =
  | 'FLAG_UNKNOWN_UNSPECIFIED'
  | 0
  | 'FLAG_ONLY_PUBLIC'
  | 1
  | 'FLAG_ONLY_PRIVATE'
  | 2
  | 'FLAG_ONLY_FORKS'
  | 4
  | 'FLAG_NO_FORKS'
  | 8
  | 'FLAG_ONLY_ARCHIVED'
  | 16
  | 'FLAG_NO_ARCHIVED'
  | 32

export type _zoekt_webserver_v1_RawConfig_Flag__Output = typeof _zoekt_webserver_v1_RawConfig_Flag[keyof typeof _zoekt_webserver_v1_RawConfig_Flag]

/**
 * RawConfig filters repositories based on their encoded RawConfig map.
 */
export interface RawConfig {
  'flags'?: (_zoekt_webserver_v1_RawConfig_Flag)[];
}

/**
 * RawConfig filters repositories based on their encoded RawConfig map.
 */
export interface RawConfig__Output {
  'flags': (_zoekt_webserver_v1_RawConfig_Flag__Output)[];
}
