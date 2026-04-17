import { z } from "zod";

export const servicePingRequestSchema = z.object({
    installId: z.string(),
    version: z.string(),
    userCount: z.number(),
    activationCode: z.string().optional(),
});
export type ServicePingRequest = z.infer<typeof servicePingRequestSchema>;

export const servicePingResponseSchema = z.object({
    license: z.object({
        plan: z.string(),
        seats: z.number(),
        status: z.string(),
    }).optional(),
});
export type ServicePingResponse = z.infer<typeof servicePingResponseSchema>;

export const checkoutResponseSchema = z.object({
    url: z.string(),
});

export const portalResponseSchema = z.object({
    url: z.string(),
});
