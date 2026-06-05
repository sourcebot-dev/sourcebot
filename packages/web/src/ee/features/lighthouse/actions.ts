'use server';

import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { ServiceError } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { decryptActivationCode, env } from "@sourcebot/shared";
import { syncWithLighthouse } from "@/features/billing/servicePing";
import { isServiceError } from "@/lib/utils";
import { client } from "@/features/billing/client";
import { Invoice } from "@/features/billing/types";

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
