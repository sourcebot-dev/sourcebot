// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from '../../../google/protobuf/Duration';
import type { FlushReason as _zoekt_webserver_v1_FlushReason, FlushReason__Output as _zoekt_webserver_v1_FlushReason__Output } from '../../../zoekt/webserver/v1/FlushReason';
import type { Long } from '@grpc/proto-loader';

export interface Stats {
  /**
   * Amount of I/O for reading contents.
   */
  'content_bytes_loaded'?: (number | string | Long);
  /**
   * Amount of I/O for reading from index.
   */
  'index_bytes_loaded'?: (number | string | Long);
  /**
   * Number of search shards that had a crash.
   */
  'crashes'?: (number | string | Long);
  /**
   * Wall clock time for this search
   */
  'duration'?: (_google_protobuf_Duration | null);
  /**
   * Number of files containing a match.
   */
  'file_count'?: (number | string | Long);
  /**
   * Number of files in shards that we considered.
   */
  'shard_files_considered'?: (number | string | Long);
  /**
   * Files that we evaluated. Equivalent to files for which all
   * atom matches (including negations) evaluated to true.
   */
  'files_considered'?: (number | string | Long);
  /**
   * Files for which we loaded file content to verify substring matches
   */
  'files_loaded'?: (number | string | Long);
  /**
   * Candidate files whose contents weren't examined because we
   * gathered enough matches.
   */
  'files_skipped'?: (number | string | Long);
  /**
   * Shards that we scanned to find matches.
   */
  'shards_scanned'?: (number | string | Long);
  /**
   * Shards that we did not process because a query was canceled.
   */
  'shards_skipped'?: (number | string | Long);
  /**
   * Shards that we did not process because the query was rejected by the
   * ngram filter indicating it had no matches.
   */
  'shards_skipped_filter'?: (number | string | Long);
  /**
   * Number of non-overlapping matches
   */
  'match_count'?: (number | string | Long);
  /**
   * Number of candidate matches as a result of searching ngrams.
   */
  'ngram_matches'?: (number | string | Long);
  /**
   * Wall clock time for queued search.
   */
  'wait'?: (_google_protobuf_Duration | null);
  /**
   * Number of times regexp was called on files that we evaluated.
   */
  'regexps_considered'?: (number | string | Long);
  /**
   * FlushReason explains why results were flushed.
   */
  'flush_reason'?: (_zoekt_webserver_v1_FlushReason);
  /**
   * NgramLookups is the number of times we accessed an ngram in the index.
   */
  'ngram_lookups'?: (number | string | Long);
  /**
   * Aggregate wall clock time spent constructing and pruning the match tree.
   * This accounts for time such as lookups in the trigram index.
   */
  'match_tree_construction'?: (_google_protobuf_Duration | null);
  /**
   * Aggregate wall clock time spent searching the match tree. This accounts
   * for the bulk of search work done looking for matches.
   */
  'match_tree_search'?: (_google_protobuf_Duration | null);
}

export interface Stats__Output {
  /**
   * Amount of I/O for reading contents.
   */
  'content_bytes_loaded': (number);
  /**
   * Amount of I/O for reading from index.
   */
  'index_bytes_loaded': (number);
  /**
   * Number of search shards that had a crash.
   */
  'crashes': (number);
  /**
   * Wall clock time for this search
   */
  'duration': (_google_protobuf_Duration__Output | null);
  /**
   * Number of files containing a match.
   */
  'file_count': (number);
  /**
   * Number of files in shards that we considered.
   */
  'shard_files_considered': (number);
  /**
   * Files that we evaluated. Equivalent to files for which all
   * atom matches (including negations) evaluated to true.
   */
  'files_considered': (number);
  /**
   * Files for which we loaded file content to verify substring matches
   */
  'files_loaded': (number);
  /**
   * Candidate files whose contents weren't examined because we
   * gathered enough matches.
   */
  'files_skipped': (number);
  /**
   * Shards that we scanned to find matches.
   */
  'shards_scanned': (number);
  /**
   * Shards that we did not process because a query was canceled.
   */
  'shards_skipped': (number);
  /**
   * Shards that we did not process because the query was rejected by the
   * ngram filter indicating it had no matches.
   */
  'shards_skipped_filter': (number);
  /**
   * Number of non-overlapping matches
   */
  'match_count': (number);
  /**
   * Number of candidate matches as a result of searching ngrams.
   */
  'ngram_matches': (number);
  /**
   * Wall clock time for queued search.
   */
  'wait': (_google_protobuf_Duration__Output | null);
  /**
   * Number of times regexp was called on files that we evaluated.
   */
  'regexps_considered': (number);
  /**
   * FlushReason explains why results were flushed.
   */
  'flush_reason': (_zoekt_webserver_v1_FlushReason__Output);
  /**
   * NgramLookups is the number of times we accessed an ngram in the index.
   */
  'ngram_lookups': (number);
  /**
   * Aggregate wall clock time spent constructing and pruning the match tree.
   * This accounts for time such as lookups in the trigram index.
   */
  'match_tree_construction': (_google_protobuf_Duration__Output | null);
  /**
   * Aggregate wall clock time spent searching the match tree. This accounts
   * for the bulk of search work done looking for matches.
   */
  'match_tree_search': (_google_protobuf_Duration__Output | null);
}
