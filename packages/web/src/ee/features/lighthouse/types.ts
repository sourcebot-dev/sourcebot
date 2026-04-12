import { z } from "zod";

export const lighthouseResponseSchema = z.object({
    plan: z.string(),
    seats: z.number(),
    status: z.string(),
});

export const checkoutResponseSchema = z.object({
    url: z.string(),
});
