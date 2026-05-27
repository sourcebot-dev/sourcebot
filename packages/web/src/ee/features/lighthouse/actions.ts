'use server';

import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { ServiceError, ServiceErrorException } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { encryptActivationCode, decryptActivationCode, env } from "@sourcebot/shared";
import { syncWithLighthouse } from "@/ee/features/lighthouse/servicePing";
import { isServiceError } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { captureEvent } from "@/lib/posthog";
import { UpsellSource } from "@/lib/posthogEvents";
import { client } from "./client";
import { Invoice } from "./types";
import { z } from "zod";

export const activateLicense = async (activationCode: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            // Check if a license already exists
            const existing = await prisma.license.findUnique({
                where: { orgId: org.id },
            });

            if (existing) {
                return {
                    statusCode: StatusCodes.CONFLICT,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: "A license already exists for this organization.",
                } satisfies ServiceError;
            }

            await prisma.license.create({
                data: {
                    orgId: org.id,
                    activationCode: encryptActivationCode(activationCode),
                },
            });

            try {
                // Bind the activation code to this install. This is the only
                // call that mutates the binding on the Lighthouse side; the
                // subsequent ping is pure read.
                const activateResult = await client.activate({
                    activationCode,
                    installId: env.SOURCEBOT_INSTALL_ID,
                });

                if (isServiceError(activateResult)) {
                    throw new ServiceErrorException(activateResult);
                }

                // Immediately sync license data from Lighthouse.
                await syncWithLighthouse(org.id);
            } catch (e) {
                // If activation or initial sync fails, remove the license record
                await prisma.license.delete({
                    where: { orgId: org.id },
                });

                throw e;
            }

            // Invalidate the (app) layout so BannerSlot re-resolves with the
            // new license.
            revalidatePath('/settings/license', 'layout');

            return { success: true };
        })
    )
);

export const claimActivationCode = async (sessionId: string): Promise<{ activationCode: string } | ServiceError> => sew(() =>
    withAuth(async ({ role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const result = await client.claimActivationCode({
                sessionId,
                installId: env.SOURCEBOT_INSTALL_ID,
            });

            if (isServiceError(result)) {
                return result;
            }

            return { activationCode: result.activationCode };
        })
    )
);

export const refreshLicense = async (): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const existing = await prisma.license.findUnique({
                where: { orgId: org.id },
            });

            if (!existing) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.NOT_FOUND,
                    message: "No license found.",
                } satisfies ServiceError;
            }

            await syncWithLighthouse(org.id);

            return { success: true };
        })
    )
);

export const createCheckoutSession = async ({
    source,
    requestTrial = false,
    interval = 'year',
    returnPath: _returnPath = '/settings/license',
    overrideEmail,
}: {
    source: UpsellSource;
    requestTrial?: boolean;
    interval?: 'month' | 'year';
    returnPath?: string;
    overrideEmail?: string;
}): Promise<{ url: string } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!user.email) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: "User does not have an email address.",
                } satisfies ServiceError;
            }

            // Validate the override on the server — never trust a client-supplied
            // email. Fall back to the authenticated user's email when omitted.
            let checkoutEmail = user.email;
            if (overrideEmail !== undefined) {
                const parsed = z.string().email().safeParse(overrideEmail);
                if (!parsed.success) {
                    return {
                        statusCode: StatusCodes.BAD_REQUEST,
                        errorCode: ErrorCode.UNEXPECTED_ERROR,
                        message: "Invalid overrideEmail.",
                    } satisfies ServiceError;
                }
                checkoutEmail = parsed.data;
            }

            const memberCount = await prisma.userToOrg.count({
                where: {
                    orgId: org.id,
                },
            });
            const quantity = Math.max(memberCount, 1);

            // Resolve the candidate against AUTH_URL so absolute paths, protocol-
            // relative paths (`//evil.com`), and bare relative paths all get
            // normalized through the URL parser. Reject anything that lands off-
            // origin, carries a fragment, or already uses the reserved query keys
            // we append below.
            let returnPathname: string;
            let returnSearch: string;
            try {
                const candidate = new URL(_returnPath, env.AUTH_URL);
                const authOrigin = new URL(env.AUTH_URL).origin;
                if (candidate.origin !== authOrigin) {
                    throw new Error('returnPath escapes AUTH_URL origin');
                }
                if (candidate.hash) {
                    throw new Error('returnPath must not include a fragment');
                }
                for (const reservedKey of ['checkout', 'session_id']) {
                    if (candidate.searchParams.has(reservedKey)) {
                        throw new Error(`returnPath must not include reserved query parameter: ${reservedKey}`);
                    }
                }
                returnPathname = candidate.pathname;
                returnSearch = candidate.search;
            } catch {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: "Invalid returnPath.",
                } satisfies ServiceError;
            }

            await captureEvent('wa_upsell_checkout_started', {
                source,
                requestTrial,
                interval,
                returnPath: `${returnPathname}${returnSearch}`,
                quantity,
            });

            // Build success/cancel URLs as raw strings so Stripe's literal
            // `{CHECKOUT_SESSION_ID}` placeholder isn't URL-encoded by URL/
            // URLSearchParams (Stripe substitutes the raw token, not %7B...%7D).
            const stripeSuccessQuery = 'checkout=success&session_id={CHECKOUT_SESSION_ID}';
            const successQuerySeparator = returnSearch ? '&' : '?';

            const result = await client.checkout({
                email: checkoutEmail,
                installId: env.SOURCEBOT_INSTALL_ID,
                quantity,
                requestTrial,
                interval,
                successUrl: `${env.AUTH_URL}${returnPathname}${returnSearch}${successQuerySeparator}${stripeSuccessQuery}`,
                cancelUrl: `${env.AUTH_URL}${returnPathname}${returnSearch}`,
            });

            if (isServiceError(result)) {
                return result;
            }

            return { url: result.url };
        })
    )
);

export const deactivateLicense = async (): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const existing = await prisma.license.findUnique({
                where: { orgId: org.id },
            });

            if (!existing) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.NOT_FOUND,
                    message: "No license found.",
                } satisfies ServiceError;
            }

            await prisma.license.delete({
                where: { orgId: org.id },
            });

            return { success: true };
        })
    )
);

export const createPortalSession = async (): Promise<{ url: string } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const license = await prisma.license.findUnique({
                where: { orgId: org.id },
            });

            if (!license) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.NOT_FOUND,
                    message: "No license found.",
                } satisfies ServiceError;
            }

            const activationCode = decryptActivationCode(license.activationCode);

            const result = await client.portal({
                activationCode,
                // Forces a license resync on the return page so any changes
                // made in the portal (e.g. payment method added) show up
                // immediately instead of waiting for the next daily ping.
                returnUrl: `${env.AUTH_URL}/settings/license?refresh=true`,
            });

            if (isServiceError(result)) {
                return result;
            }

            return { url: result.url };
        })
    )
);

export const getAllInvoices = async (): Promise<Invoice[] | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const license = await prisma.license.findUnique({
                where: { orgId: org.id },
            });

            if (!license) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.NOT_FOUND,
                    message: "No license found.",
                } satisfies ServiceError;
            }

            const activationCode = decryptActivationCode(license.activationCode);

            const allInvoices: Invoice[] = [];
            let startingAfter: string | undefined;
            while (true) {
                const result = await client.invoices({
                    activationCode,
                    limit: 100,
                    ...(startingAfter && { startingAfter }),
                });

                if (isServiceError(result)) {
                    return result;
                }

                allInvoices.push(...result.invoices);

                if (!result.hasMore) {
                    break;
                }

                const lastInvoice = result.invoices[result.invoices.length - 1];
                if (!lastInvoice) {
                    break;
                }
                startingAfter = lastInvoice.id;
            }

            return allInvoices;
        })
    )
);
