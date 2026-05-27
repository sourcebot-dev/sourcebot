import { z } from "zod";

export const servicePingRequestSchema = z.object({
    installId: z.string(),
    version: z.string(),
    hostname: z.string(),
    userCount: z.number().int().nonnegative(),
    repoCount: z.number().int().nonnegative(),
    dauCount: z.number().int().nonnegative(),
    wauCount: z.number().int().nonnegative(),
    mauCount: z.number().int().nonnegative(),
    deploymentType: z.string(),
    isTelemetryEnabled: z.boolean(),
    activationCode: z.string().optional(),
});
export type ServicePingRequest = z.infer<typeof servicePingRequestSchema>;

export const activateRequestSchema = z.object({
    activationCode: z.string(),
    installId: z.string(),
});
export type ActivateRequest = z.infer<typeof activateRequestSchema>;

export const activateResponseSchema = z.object({
    status: z.literal('ok'),
    reactivationsRemaining: z.number().int(),
});
export type ActivateResponse = z.infer<typeof activateResponseSchema>;

export const claimActivationCodeRequestSchema = z.object({
    sessionId: z.string(),
    installId: z.string(),
});
export type ClaimActivationCodeRequest = z.infer<typeof claimActivationCodeRequestSchema>;

export const claimActivationCodeResponseSchema = z.object({
    activationCode: z.string(),
});
export type ClaimActivationCodeResponse = z.infer<typeof claimActivationCodeResponseSchema>;

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
        nextRenewalAt: z.string().datetime().nullable(),
        nextRenewalAmount: z.number().int().nullable(),
        cancelAt: z.string().datetime().nullable(),
        trialEnd: z.string().datetime().nullable(),
        hasPaymentMethod: z.boolean(),
    }).optional(),
});
export type ServicePingResponse = z.infer<typeof servicePingResponseSchema>;

export const checkoutRequestSchema = z.object({
    email: z.string().email(),
    installId: z.string(),
    quantity: z.number().int().positive(),
    requestTrial: z.boolean().default(false),
    interval: z.enum(['month', 'year']).default('month'),
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

export const invoiceSchema = z.object({
    id: z.string(),
    createdAt: z.string(),
    amount: z.number().int(),
    currency: z.string(),
    status: z.string(),
    hostedInvoiceUrl: z.string().nullable(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoicesRequestSchema = z.object({
    activationCode: z.string(),
    limit: z.number().int().positive().max(100).optional(),
    startingAfter: z.string().optional(),
});
export type InvoicesRequest = z.infer<typeof invoicesRequestSchema>;

export const invoicesResponseSchema = z.object({
    invoices: z.array(invoiceSchema),
    hasMore: z.boolean(),
});
export type InvoicesResponse = z.infer<typeof invoicesResponseSchema>;

const pricingTierSchema = z.object({
    unitAmount: z.number().int(),
    currency: z.string(),
});

export const offersQuerySchema = z.object({
    installId: z.string(),
});
export type OffersQuery = z.infer<typeof offersQuerySchema>;

export const offersResponseSchema = z.object({
    pricing: z.object({
        monthly: pricingTierSchema,
        annual: pricingTierSchema,
    }),
    trial: z.object({
        durationDays: z.number().int(),
        eligible: z.boolean(),
        creditCardRequired: z.boolean(),
    }),
});
export type OffersResponse = z.infer<typeof offersResponseSchema>;
