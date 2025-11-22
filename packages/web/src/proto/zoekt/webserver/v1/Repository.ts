// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { RepositoryBranch as _zoekt_webserver_v1_RepositoryBranch, RepositoryBranch__Output as _zoekt_webserver_v1_RepositoryBranch__Output } from '../../../zoekt/webserver/v1/RepositoryBranch';
import type { Repository as _zoekt_webserver_v1_Repository, Repository__Output as _zoekt_webserver_v1_Repository__Output } from '../../../zoekt/webserver/v1/Repository';
import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { Long } from '@grpc/proto-loader';

export interface Repository {
  /**
   * Sourcegraph's repository ID
   */
  'id'?: (number);
  /**
   * The repository name
   */
  'name'?: (string);
  /**
   * The repository URL.
   */
  'url'?: (string);
  /**
   * The physical source where this repo came from, eg. full
   * path to the zip filename or git repository directory. This
   * will not be exposed in the UI, but can be used to detect
   * orphaned index shards.
   */
  'source'?: (string);
  /**
   * The branches indexed in this repo.
   */
  'branches'?: (_zoekt_webserver_v1_RepositoryBranch)[];
  /**
   * Nil if this is not the super project.
   */
  'sub_repo_map'?: ({[key: string]: _zoekt_webserver_v1_Repository});
  /**
   * URL template to link to the commit of a branch
   */
  'commit_url_template'?: (string);
  /**
   * The repository URL for getting to a file.  Has access to
   * {{.Version}}, {{.Path}}
   */
  'file_url_template'?: (string);
  /**
   * The URL fragment to add to a file URL for line numbers. has
   * access to {{.LineNumber}}. The fragment should include the
   * separator, generally '#' or ';'.
   */
  'line_fragment_template'?: (string);
  /**
   * Perf optimization: priority is set when we load the shard. It corresponds to
   * the value of "priority" stored in RawConfig.
   */
  'priority'?: (number | string);
  /**
   * All zoekt.* configuration settings.
   */
  'raw_config'?: ({[key: string]: string});
  /**
   * Importance of the repository, bigger is more important
   */
  'rank'?: (number);
  /**
   * index_options is a hash of the options used to create the index for the
   * repo.
   */
  'index_options'?: (string);
  /**
   * has_symbols is true if this repository has indexed ctags
   * output. Sourcegraph specific: This field is more appropriate for
   * IndexMetadata. However, we store it here since the Sourcegraph frontend
   * can read this structure but not IndexMetadata.
   */
  'has_symbols'?: (boolean);
  /**
   * tombstone is true if we are not allowed to search this repo.
   */
  'tombstone'?: (boolean);
  /**
   * latest_commit_date is the date of the latest commit among all indexed Branches.
   * The date might be time.Time's 0-value if the repository was last indexed
   * before this field was added.
   */
  'latest_commit_date'?: (_google_protobuf_Timestamp | null);
  /**
   * file_tombstones is a set of file paths that should be ignored across all branches
   * in this shard.
   */
  'file_tombstones'?: (string)[];
  /**
   * tenant_id is the tenant ID of the repository.
   */
  'tenant_id'?: (number | string | Long);
}

export interface Repository__Output {
  /**
   * Sourcegraph's repository ID
   */
  'id': (number);
  /**
   * The repository name
   */
  'name': (string);
  /**
   * The repository URL.
   */
  'url': (string);
  /**
   * The physical source where this repo came from, eg. full
   * path to the zip filename or git repository directory. This
   * will not be exposed in the UI, but can be used to detect
   * orphaned index shards.
   */
  'source': (string);
  /**
   * The branches indexed in this repo.
   */
  'branches': (_zoekt_webserver_v1_RepositoryBranch__Output)[];
  /**
   * Nil if this is not the super project.
   */
  'sub_repo_map': ({[key: string]: _zoekt_webserver_v1_Repository__Output});
  /**
   * URL template to link to the commit of a branch
   */
  'commit_url_template': (string);
  /**
   * The repository URL for getting to a file.  Has access to
   * {{.Version}}, {{.Path}}
   */
  'file_url_template': (string);
  /**
   * The URL fragment to add to a file URL for line numbers. has
   * access to {{.LineNumber}}. The fragment should include the
   * separator, generally '#' or ';'.
   */
  'line_fragment_template': (string);
  /**
   * Perf optimization: priority is set when we load the shard. It corresponds to
   * the value of "priority" stored in RawConfig.
   */
  'priority': (number);
  /**
   * All zoekt.* configuration settings.
   */
  'raw_config': ({[key: string]: string});
  /**
   * Importance of the repository, bigger is more important
   */
  'rank': (number);
  /**
   * index_options is a hash of the options used to create the index for the
   * repo.
   */
  'index_options': (string);
  /**
   * has_symbols is true if this repository has indexed ctags
   * output. Sourcegraph specific: This field is more appropriate for
   * IndexMetadata. However, we store it here since the Sourcegraph frontend
   * can read this structure but not IndexMetadata.
   */
  'has_symbols': (boolean);
  /**
   * tombstone is true if we are not allowed to search this repo.
   */
  'tombstone': (boolean);
  /**
   * latest_commit_date is the date of the latest commit among all indexed Branches.
   * The date might be time.Time's 0-value if the repository was last indexed
   * before this field was added.
   */
  'latest_commit_date': (_google_protobuf_Timestamp__Output | null);
  /**
   * file_tombstones is a set of file paths that should be ignored across all branches
   * in this shard.
   */
  'file_tombstones': (string)[];
  /**
   * tenant_id is the tenant ID of the repository.
   */
  'tenant_id': (number);
}
