// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { LineMatch as _zoekt_webserver_v1_LineMatch, LineMatch__Output as _zoekt_webserver_v1_LineMatch__Output } from '../../../zoekt/webserver/v1/LineMatch';
import type { ChunkMatch as _zoekt_webserver_v1_ChunkMatch, ChunkMatch__Output as _zoekt_webserver_v1_ChunkMatch__Output } from '../../../zoekt/webserver/v1/ChunkMatch';

/**
 * FileMatch contains all the matches within a file.
 */
export interface FileMatch {
  /**
   * Ranking; the higher, the better.
   */
  'score'?: (number | string);
  /**
   * For debugging. Needs DebugScore set, but public so tests in
   * other packages can print some diagnostics.
   */
  'debug'?: (string);
  /**
   * The repository-relative path to the file.
   * 🚨 Warning: file_name might not be a valid UTF-8 string.
   */
  'file_name'?: (Buffer | Uint8Array | string);
  /**
   * Repository is the globally unique name of the repo of the
   * match
   */
  'repository'?: (string);
  'branches'?: (string)[];
  /**
   * One of line_matches or chunk_matches will be returned depending on whether
   * the SearchOptions.ChunkMatches is set.
   */
  'line_matches'?: (_zoekt_webserver_v1_LineMatch)[];
  'chunk_matches'?: (_zoekt_webserver_v1_ChunkMatch)[];
  /**
   * repository_id is a Sourcegraph extension. This is the ID of Repository in
   * Sourcegraph.
   */
  'repository_id'?: (number);
  'repository_priority'?: (number | string);
  /**
   * Only set if requested
   */
  'content'?: (Buffer | Uint8Array | string);
  /**
   * Checksum of the content.
   */
  'checksum'?: (Buffer | Uint8Array | string);
  /**
   * Detected language of the result.
   */
  'language'?: (string);
  /**
   * sub_repository_name is the globally unique name of the repo,
   * if it came from a subrepository
   */
  'sub_repository_name'?: (string);
  /**
   * sub_repository_path holds the prefix where the subrepository
   * was mounted.
   */
  'sub_repository_path'?: (string);
  /**
   * Commit SHA1 (hex) of the (sub)repo holding the file.
   */
  'version'?: (string);
}

/**
 * FileMatch contains all the matches within a file.
 */
export interface FileMatch__Output {
  /**
   * Ranking; the higher, the better.
   */
  'score': (number);
  /**
   * For debugging. Needs DebugScore set, but public so tests in
   * other packages can print some diagnostics.
   */
  'debug': (string);
  /**
   * The repository-relative path to the file.
   * 🚨 Warning: file_name might not be a valid UTF-8 string.
   */
  'file_name': (Buffer);
  /**
   * Repository is the globally unique name of the repo of the
   * match
   */
  'repository': (string);
  'branches': (string)[];
  /**
   * One of line_matches or chunk_matches will be returned depending on whether
   * the SearchOptions.ChunkMatches is set.
   */
  'line_matches': (_zoekt_webserver_v1_LineMatch__Output)[];
  'chunk_matches': (_zoekt_webserver_v1_ChunkMatch__Output)[];
  /**
   * repository_id is a Sourcegraph extension. This is the ID of Repository in
   * Sourcegraph.
   */
  'repository_id': (number);
  'repository_priority': (number);
  /**
   * Only set if requested
   */
  'content': (Buffer);
  /**
   * Checksum of the content.
   */
  'checksum': (Buffer);
  /**
   * Detected language of the result.
   */
  'language': (string);
  /**
   * sub_repository_name is the globally unique name of the repo,
   * if it came from a subrepository
   */
  'sub_repository_name': (string);
  /**
   * sub_repository_path holds the prefix where the subrepository
   * was mounted.
   */
  'sub_repository_path': (string);
  /**
   * Commit SHA1 (hex) of the (sub)repo holding the file.
   */
  'version': (string);
}
