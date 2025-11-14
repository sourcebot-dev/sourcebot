// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { RepositoryBranch as _zoekt_webserver_v1_RepositoryBranch, RepositoryBranch__Output as _zoekt_webserver_v1_RepositoryBranch__Output } from '../../../zoekt/webserver/v1/RepositoryBranch';
import type { Long } from '@grpc/proto-loader';

export interface MinimalRepoListEntry {
  'has_symbols'?: (boolean);
  'branches'?: (_zoekt_webserver_v1_RepositoryBranch)[];
  'index_time_unix'?: (number | string | Long);
}

export interface MinimalRepoListEntry__Output {
  'has_symbols': (boolean);
  'branches': (_zoekt_webserver_v1_RepositoryBranch__Output)[];
  'index_time_unix': (number);
}
