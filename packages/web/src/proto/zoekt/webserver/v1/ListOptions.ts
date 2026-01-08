// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto


// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

export const _zoekt_webserver_v1_ListOptions_RepoListField = {
  REPO_LIST_FIELD_UNKNOWN_UNSPECIFIED: 'REPO_LIST_FIELD_UNKNOWN_UNSPECIFIED',
  REPO_LIST_FIELD_REPOS: 'REPO_LIST_FIELD_REPOS',
  REPO_LIST_FIELD_REPOS_MAP: 'REPO_LIST_FIELD_REPOS_MAP',
} as const;

export type _zoekt_webserver_v1_ListOptions_RepoListField =
  | 'REPO_LIST_FIELD_UNKNOWN_UNSPECIFIED'
  | 0
  | 'REPO_LIST_FIELD_REPOS'
  | 1
  | 'REPO_LIST_FIELD_REPOS_MAP'
  | 3

export type _zoekt_webserver_v1_ListOptions_RepoListField__Output = typeof _zoekt_webserver_v1_ListOptions_RepoListField[keyof typeof _zoekt_webserver_v1_ListOptions_RepoListField]

export interface ListOptions {
  /**
   * Field decides which field to populate in RepoList response.
   */
  'field'?: (_zoekt_webserver_v1_ListOptions_RepoListField);
}

export interface ListOptions__Output {
  /**
   * Field decides which field to populate in RepoList response.
   */
  'field': (_zoekt_webserver_v1_ListOptions_RepoListField__Output);
}
