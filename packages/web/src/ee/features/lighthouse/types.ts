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
        entitlements: z.string().array(),
        seats: z.number(),
        status: z.string(),
        planName: z.string(),
        unitAmount: z.number().int(),
        currency: z.string(),
        interval: z.string(),
        intervalCount: z.number().int(),
        nextRenewalAt: z.string().datetime(),
        nextRenewalAmount: z.number().int(),
    }).optional(),
});
export type ServicePingResponse = z.infer<typeof servicePingResponseSchema>;

export const checkoutRequestSchema = z.object({
    email: z.string().email(),
    quantity: z.number().int().positive(),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const checkoutResponseSchema = z.object({
    url: z.string(),
});
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export const portalRequestSchema = z.object({
    activationCode: z.string(),
    returnUrl: z.string().url(),
});
export type PortalRequest = z.infer<typeof portalRequestSchema>;

export const portalResponseSchema = z.object({
    url: z.string(),
});
export type PortalResponse = z.infer<typeof portalResponseSchema>;
