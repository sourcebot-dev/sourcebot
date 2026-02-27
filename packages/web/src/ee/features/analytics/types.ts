import { z } from "zod";

export const analyticsRowSchema = z.object({
  period: z.enum(['day', 'week', 'month']),
  bucket: z.date(),
  active_users: z.number(),
  web_code_searches: z.number(),
  web_navigations: z.number(),
  web_ask_chats: z.number(),
  web_active_users: z.number(),
  mcp_requests: z.number(),
  mcp_active_users: z.number(),
  api_requests: z.number(),
  api_active_users: z.number(),
});
export type AnalyticsRow = z.infer<typeof analyticsRowSchema>;

export type AnalyticsResponse = {
  rows: AnalyticsRow[];
  retentionDays: number;
  oldestRecordDate: Date | null;
};