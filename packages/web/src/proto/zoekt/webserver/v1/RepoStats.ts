// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { Long } from '@grpc/proto-loader';

/**
 * RepoStats is a collection of statistics for a set of repositories.
 */
export interface RepoStats {
  /**
   * repos is used for aggregrating the number of repositories.
   */
  'repos'?: (number | string | Long);
  /**
   * shards is the total number of search shards.
   */
  'shards'?: (number | string | Long);
  /**
   * documents holds the number of documents or files.
   */
  'documents'?: (number | string | Long);
  /**
   * index_bytes is the amount of RAM used for index overhead.
   */
  'index_bytes'?: (number | string | Long);
  /**
   * content_bytes is the amount of RAM used for raw content.
   */
  'content_bytes'?: (number | string | Long);
  /**
   * new_lines_count is the number of newlines "\n" that appear in the zoekt
   * indexed documents. This is not exactly the same as line count, since it
   * will not include lines not terminated by "\n" (eg a file with no "\n", or
   * a final line without "\n"). Note: Zoekt deduplicates documents across
   * branches, so if a path has the same contents on multiple branches, there
   * is only one document for it. As such that document's newlines is only
   * counted once. See DefaultBranchNewLinesCount and AllBranchesNewLinesCount
   * for counts which do not deduplicate.
   */
  'new_lines_count'?: (number | string | Long);
  /**
   * default_branch_new_lines_count is the number of newlines "\n" in the default
   * branch.
   */
  'default_branch_new_lines_count'?: (number | string | Long);
  /**
   * other_branches_new_lines_count is the number of newlines "\n" in all branches
   * except the default branch.
   */
  'other_branches_new_lines_count'?: (number | string | Long);
}

/**
 * RepoStats is a collection of statistics for a set of repositories.
 */
export interface RepoStats__Output {
  /**
   * repos is used for aggregrating the number of repositories.
   */
  'repos': (number);
  /**
   * shards is the total number of search shards.
   */
  'shards': (number);
  /**
   * documents holds the number of documents or files.
   */
  'documents': (number);
  /**
   * index_bytes is the amount of RAM used for index overhead.
   */
  'index_bytes': (number);
  /**
   * content_bytes is the amount of RAM used for raw content.
   */
  'content_bytes': (number);
  /**
   * new_lines_count is the number of newlines "\n" that appear in the zoekt
   * indexed documents. This is not exactly the same as line count, since it
   * will not include lines not terminated by "\n" (eg a file with no "\n", or
   * a final line without "\n"). Note: Zoekt deduplicates documents across
   * branches, so if a path has the same contents on multiple branches, there
   * is only one document for it. As such that document's newlines is only
   * counted once. See DefaultBranchNewLinesCount and AllBranchesNewLinesCount
   * for counts which do not deduplicate.
   */
  'new_lines_count': (number);
  /**
   * default_branch_new_lines_count is the number of newlines "\n" in the default
   * branch.
   */
  'default_branch_new_lines_count': (number);
  /**
   * other_branches_new_lines_count is the number of newlines "\n" in all branches
   * except the default branch.
   */
  'other_branches_new_lines_count': (number);
}
