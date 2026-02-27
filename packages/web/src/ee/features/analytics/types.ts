import { z } from "zod";

export const analyticsRowSchema = z.object({
  period: z.enum(['day', 'week', 'month']),
  bucket: z.date(),
  code_searches: z.number(),
  navigations: z.number(),
  ask_chats: z.number(),
  mcp_requests: z.number(),
  api_requests: z.number(),
  active_users: z.number(),
});
export type AnalyticsRow = z.infer<typeof analyticsRowSchema>;

export type AnalyticsResponse = {
  rows: AnalyticsRow[];
  retentionDays: number;
  oldestRecordDate: Date | null;
};