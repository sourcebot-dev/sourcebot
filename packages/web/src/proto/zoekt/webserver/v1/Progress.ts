// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto


/**
 * Progress contains information about the global progress of the running search query.
 * This is used by the frontend to reorder results and emit them when stable.
 * Sourcegraph specific: this is used when querying multiple zoekt-webserver instances.
 */
export interface Progress {
  /**
   * Priority of the shard that was searched.
   */
  'priority'?: (number | string);
  /**
   * max_pending_priority is the maximum priority of pending result that is being searched in parallel.
   * This is used to reorder results when the result set is known to be stable-- that is, when a result's
   * Priority is greater than the max(MaxPendingPriority) from the latest results of each backend, it can be returned to the user.
   * 
   * max_pending_priority decreases monotonically in each SearchResult.
   */
  'max_pending_priority'?: (number | string);
}

/**
 * Progress contains information about the global progress of the running search query.
 * This is used by the frontend to reorder results and emit them when stable.
 * Sourcegraph specific: this is used when querying multiple zoekt-webserver instances.
 */
export interface Progress__Output {
  /**
   * Priority of the shard that was searched.
   */
  'priority': (number);
  /**
   * max_pending_priority is the maximum priority of pending result that is being searched in parallel.
   * This is used to reorder results when the result set is known to be stable-- that is, when a result's
   * Priority is greater than the max(MaxPendingPriority) from the latest results of each backend, it can be returned to the user.
   * 
   * max_pending_priority decreases monotonically in each SearchResult.
   */
  'max_pending_priority': (number);
}
