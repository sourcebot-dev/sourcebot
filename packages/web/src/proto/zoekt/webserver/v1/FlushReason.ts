// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

export const FlushReason = {
  FLUSH_REASON_UNKNOWN_UNSPECIFIED: 'FLUSH_REASON_UNKNOWN_UNSPECIFIED',
  FLUSH_REASON_TIMER_EXPIRED: 'FLUSH_REASON_TIMER_EXPIRED',
  FLUSH_REASON_FINAL_FLUSH: 'FLUSH_REASON_FINAL_FLUSH',
  FLUSH_REASON_MAX_SIZE: 'FLUSH_REASON_MAX_SIZE',
} as const;

export type FlushReason =
  | 'FLUSH_REASON_UNKNOWN_UNSPECIFIED'
  | 0
  | 'FLUSH_REASON_TIMER_EXPIRED'
  | 1
  | 'FLUSH_REASON_FINAL_FLUSH'
  | 2
  | 'FLUSH_REASON_MAX_SIZE'
  | 3

export type FlushReason__Output = typeof FlushReason[keyof typeof FlushReason]
