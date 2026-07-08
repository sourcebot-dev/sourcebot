import { z } from "zod";

/**
 * A best-effort snapshot of the host / container resources the deployment is
 * running with. Used to quickly diagnose resource issues (e.g. insufficient
 * RAM) from the service ping. Every field is best-effort; anything we can't
 * read is reported as `null`.
 */
export const systemInfoSchema = z.object({
    platform: z.string(),
    arch: z.string(),

    // CPU. `cpuQuota` is the effective cgroup CPU limit in cores (null when
    // unset or unreadable), which is what a container is actually allowed to use.
    cpuQuota: z.number().nonnegative().nullable(),

    // Memory, in MiB, from the cgroup: the container's actual RAM limit and
    // current usage (null when unset or unreadable).
    memoryLimitMiB: z.number().nonnegative().nullable(),
    memoryUsedMiB: z.number().nonnegative().nullable(),

    // Disk, in MiB, for the DATA_CACHE_DIR volume (where repos are indexed).
    diskTotalMiB: z.number().nonnegative().nullable(),
    diskFreeMiB: z.number().nonnegative().nullable(),
});
export type SystemInfo = z.infer<typeof systemInfoSchema>;

export const servicePingRequestSchema = z.object({
    installId: z.string(),
    version: z.string(),
    hostname: z.string(),
    /**
     * The number of billed users: active (non-suspended) members who have been
     * active in the org at least once. Provisioned members who have never
     * signed in do not count towards this.
     */
    userCount: z.number().int().nonnegative(),
    repoCount: z.number().int().nonnegative(),
    dauCount: z.number().int().nonnegative(),
    wauCount: z.number().int().nonnegative(),
    mauCount: z.number().int().nonnegative(),
    deploymentType: z.string(),
    isTelemetryEnabled: z.boolean(),
    isLanguageModelConfigured: z.boolean(),
    activationCode: z.string().optional(),
    // optional for back-compat with Lighthouse deployments that predate it.
    systemInfo: systemInfoSchema.optional(),
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

export const yearlyTermStatusSchema = z.object({
    termStartedAt: z.string().datetime(),
    termEndsAt: z.string().datetime(),
    totalQuartersInTerm: z.number().int(),
    currentQuarterNumber: z.number().int(),
    currentQuarterStartedAt: z.string().datetime(),
    currentQuarterEndsAt: z.string().datetime(),
    committedSeats: z.number().int(),
    overageSeats: z.number().int(),
    billableOverageSeats: z.number().int(),
    peakSeats: z.number().int(),
});
export type YearlyTermStatus = z.infer<typeof yearlyTermStatusSchema>;

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
        yearlyTermStatus: yearlyTermStatusSchema.optional(),
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
    existingActivationCode: z.string().optional(),
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
