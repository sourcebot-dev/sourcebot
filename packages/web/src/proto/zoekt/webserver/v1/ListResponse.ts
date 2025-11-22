// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { RepoListEntry as _zoekt_webserver_v1_RepoListEntry, RepoListEntry__Output as _zoekt_webserver_v1_RepoListEntry__Output } from '../../../zoekt/webserver/v1/RepoListEntry';
import type { MinimalRepoListEntry as _zoekt_webserver_v1_MinimalRepoListEntry, MinimalRepoListEntry__Output as _zoekt_webserver_v1_MinimalRepoListEntry__Output } from '../../../zoekt/webserver/v1/MinimalRepoListEntry';
import type { RepoStats as _zoekt_webserver_v1_RepoStats, RepoStats__Output as _zoekt_webserver_v1_RepoStats__Output } from '../../../zoekt/webserver/v1/RepoStats';
import type { Long } from '@grpc/proto-loader';

export interface ListResponse {
  /**
   * Returned when ListOptions.Field is RepoListFieldRepos.
   */
  'repos'?: (_zoekt_webserver_v1_RepoListEntry)[];
  /**
   * ReposMap is set when ListOptions.Field is RepoListFieldReposMap.
   */
  'repos_map'?: ({[key: number]: _zoekt_webserver_v1_MinimalRepoListEntry});
  'crashes'?: (number | string | Long);
  /**
   * Stats response to a List request.
   * This is the aggregate RepoStats of all repos matching the input query.
   */
  'stats'?: (_zoekt_webserver_v1_RepoStats | null);
}

export interface ListResponse__Output {
  /**
   * Returned when ListOptions.Field is RepoListFieldRepos.
   */
  'repos': (_zoekt_webserver_v1_RepoListEntry__Output)[];
  /**
   * ReposMap is set when ListOptions.Field is RepoListFieldReposMap.
   */
  'repos_map': ({[key: number]: _zoekt_webserver_v1_MinimalRepoListEntry__Output});
  'crashes': (number);
  /**
   * Stats response to a List request.
   * This is the aggregate RepoStats of all repos matching the input query.
   */
  'stats': (_zoekt_webserver_v1_RepoStats__Output | null);
}
