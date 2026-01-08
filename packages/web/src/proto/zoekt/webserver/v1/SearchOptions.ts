// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from '../../../google/protobuf/Duration';
import type { Long } from '@grpc/proto-loader';

export interface SearchOptions {
  /**
   * Return an upper-bound estimate of eligible documents in
   * stats.ShardFilesConsidered.
   */
  'estimate_doc_count'?: (boolean);
  /**
   * Return the whole file.
   */
  'whole'?: (boolean);
  /**
   * Maximum number of matches: skip all processing an index
   * shard after we found this many non-overlapping matches.
   */
  'shard_max_match_count'?: (number | string | Long);
  /**
   * Maximum number of matches: stop looking for more matches
   * once we have this many matches across shards.
   */
  'total_max_match_count'?: (number | string | Long);
  /**
   * Maximum number of matches: skip processing documents for a repository in
   * a shard once we have found ShardRepoMaxMatchCount.
   * 
   * A compound shard may contain multiple repositories. This will most often
   * be set to 1 to find all repositories containing a result.
   */
  'shard_repo_max_match_count'?: (number | string | Long);
  /**
   * Abort the search after this much time has passed.
   */
  'max_wall_time'?: (_google_protobuf_Duration | null);
  /**
   * FlushWallTime if non-zero will stop streaming behaviour at first and
   * instead will collate and sort results. At FlushWallTime the results will
   * be sent and then the behaviour will revert to the normal streaming.
   */
  'flush_wall_time'?: (_google_protobuf_Duration | null);
  /**
   * Truncates the number of documents (i.e. files) after collating and
   * sorting the results.
   */
  'max_doc_display_count'?: (number | string | Long);
  /**
   * If set to a number greater than zero then up to this many number
   * of context lines will be added before and after each matched line.
   * Note that the included context lines might contain matches and
   * it's up to the consumer of the result to remove those lines.
   */
  'num_context_lines'?: (number | string | Long);
  /**
   * If true, ChunkMatches will be returned in each FileMatch rather than LineMatches
   * EXPERIMENTAL: the behavior of this flag may be changed in future versions.
   */
  'chunk_matches'?: (boolean);
  /**
   * Trace turns on opentracing for this request if true and if the Jaeger address was provided as
   * a command-line flag
   */
  'trace'?: (boolean);
  /**
   * If set, the search results will contain debug information for scoring.
   */
  'debug_score'?: (boolean);
  /**
   * EXPERIMENTAL. If true, use text search scoring instead of the default scoring formula.
   * Currently, this treats each match in a file as a term and computes an approximation to BM25.
   * When enabled, all other scoring signals are ignored, including document ranks.
   */
  'use_bm25_scoring'?: (boolean);
  /**
   * Truncates the number of matchs after collating and sorting the results.
   */
  'max_match_display_count'?: (number | string | Long);
}

export interface SearchOptions__Output {
  /**
   * Return an upper-bound estimate of eligible documents in
   * stats.ShardFilesConsidered.
   */
  'estimate_doc_count': (boolean);
  /**
   * Return the whole file.
   */
  'whole': (boolean);
  /**
   * Maximum number of matches: skip all processing an index
   * shard after we found this many non-overlapping matches.
   */
  'shard_max_match_count': (number);
  /**
   * Maximum number of matches: stop looking for more matches
   * once we have this many matches across shards.
   */
  'total_max_match_count': (number);
  /**
   * Maximum number of matches: skip processing documents for a repository in
   * a shard once we have found ShardRepoMaxMatchCount.
   * 
   * A compound shard may contain multiple repositories. This will most often
   * be set to 1 to find all repositories containing a result.
   */
  'shard_repo_max_match_count': (number);
  /**
   * Abort the search after this much time has passed.
   */
  'max_wall_time': (_google_protobuf_Duration__Output | null);
  /**
   * FlushWallTime if non-zero will stop streaming behaviour at first and
   * instead will collate and sort results. At FlushWallTime the results will
   * be sent and then the behaviour will revert to the normal streaming.
   */
  'flush_wall_time': (_google_protobuf_Duration__Output | null);
  /**
   * Truncates the number of documents (i.e. files) after collating and
   * sorting the results.
   */
  'max_doc_display_count': (number);
  /**
   * If set to a number greater than zero then up to this many number
   * of context lines will be added before and after each matched line.
   * Note that the included context lines might contain matches and
   * it's up to the consumer of the result to remove those lines.
   */
  'num_context_lines': (number);
  /**
   * If true, ChunkMatches will be returned in each FileMatch rather than LineMatches
   * EXPERIMENTAL: the behavior of this flag may be changed in future versions.
   */
  'chunk_matches': (boolean);
  /**
   * Trace turns on opentracing for this request if true and if the Jaeger address was provided as
   * a command-line flag
   */
  'trace': (boolean);
  /**
   * If set, the search results will contain debug information for scoring.
   */
  'debug_score': (boolean);
  /**
   * EXPERIMENTAL. If true, use text search scoring instead of the default scoring formula.
   * Currently, this treats each match in a file as a term and computes an approximation to BM25.
   * When enabled, all other scoring signals are ignored, including document ranks.
   */
  'use_bm25_scoring': (boolean);
  /**
   * Truncates the number of matchs after collating and sorting the results.
   */
  'max_match_display_count': (number);
}
