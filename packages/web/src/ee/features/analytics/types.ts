import { z } from "zod";

export const analyticsResponseSchema = z.array(z.object({
  period: z.enum(['day', 'week', 'month']),
  bucket: z.date(),
  code_searches: z.number(),
  navigations: z.number(),
  active_users: z.number(),
}))
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;