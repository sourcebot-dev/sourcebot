// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { Repository as _zoekt_webserver_v1_Repository, Repository__Output as _zoekt_webserver_v1_Repository__Output } from '../../../zoekt/webserver/v1/Repository';
import type { IndexMetadata as _zoekt_webserver_v1_IndexMetadata, IndexMetadata__Output as _zoekt_webserver_v1_IndexMetadata__Output } from '../../../zoekt/webserver/v1/IndexMetadata';
import type { RepoStats as _zoekt_webserver_v1_RepoStats, RepoStats__Output as _zoekt_webserver_v1_RepoStats__Output } from '../../../zoekt/webserver/v1/RepoStats';

export interface RepoListEntry {
  'repository'?: (_zoekt_webserver_v1_Repository | null);
  'index_metadata'?: (_zoekt_webserver_v1_IndexMetadata | null);
  'stats'?: (_zoekt_webserver_v1_RepoStats | null);
}

export interface RepoListEntry__Output {
  'repository': (_zoekt_webserver_v1_Repository__Output | null);
  'index_metadata': (_zoekt_webserver_v1_IndexMetadata__Output | null);
  'stats': (_zoekt_webserver_v1_RepoStats__Output | null);
}
