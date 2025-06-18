import { z } from "zod";

export const analyticsResponseSchema = z.array(z.object({
    date: z.date(),
    dau: z.number(),
}))
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;