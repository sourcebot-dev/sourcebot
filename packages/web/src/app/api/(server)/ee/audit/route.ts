'use server';

import { fetchAuditRecords } from "@/ee/features/audit/actions";
import { apiHandler } from "@/lib/apiHandler";
import { ErrorCode } from "@/lib/errorCodes";
import { buildLinkHeader } from "@/lib/pagination";
import { serviceErrorResponse, queryParamsSchemaValidationError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { getEntitlements } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";
import { NextRequest } from "next/server";
import { z } from "zod";

const auditQueryParamsBaseSchema = z.object({
    since: z.string().datetime().optional(),
    until: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(100).default(50),
});

const auditQueryParamsSchema = auditQueryParamsBaseSchema.refine(
    (data) => !(data.since && data.until && new Date(data.since) >= new Date(data.until)),
    { message: "'since' must be before 'until'", path: ["since"] }
);

export const GET = apiHandler(async (request: NextRequest) => {
    const entitlements = getEntitlements();
    if (!entitlements.includes('audit')) {
        return serviceErrorResponse({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.NOT_FOUND,
            message: "Audit logging is not enabled for your license",
        });
    }

    const rawParams = Object.fromEntries(
        Object.keys(auditQueryParamsBaseSchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined
        ])
    );
    const parsed = auditQueryParamsSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const { page, perPage, since, until } = parsed.data;
    const skip = (page - 1) * perPage;

    const result = await fetchAuditRecords({
        skip,
        take: perPage,
        since: since ? new Date(since) : undefined,
        until: until ? new Date(until) : undefined,
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    const { auditRecords, totalCount } = result;

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('X-Total-Count', totalCount.toString());

    const linkHeader = buildLinkHeader(request, {
        page,
        perPage,
        totalCount,
        extraParams: {
            ...(since ? { since } : {}),
            ...(until ? { until } : {}),
        },
    });
    if (linkHeader) headers.set('Link', linkHeader);

    return new Response(JSON.stringify(auditRecords), { status: 200, headers });
});
