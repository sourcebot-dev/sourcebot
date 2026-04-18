import { fetchWithRetry, isServiceError } from "@/lib/utils";
import { env } from "@sourcebot/shared";
import {
    CheckoutRequest,
    CheckoutResponse,
    checkoutResponseSchema,
    InvoicesRequest,
    InvoicesResponse,
    invoicesResponseSchema,
    PortalRequest,
    PortalResponse,
    portalResponseSchema,
    ServicePingRequest,
    ServicePingResponse,
    servicePingResponseSchema,
} from "./types";
import { ServiceError } from "@/lib/serviceError";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

export const client = {
    ping: async (body: ServicePingRequest): Promise<ServicePingResponse | ServiceError> => {
        const response = await fetchWithRetry(`${env.SOURCEBOT_LIGHTHOUSE_URL}/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        return parseResponseBody(response, servicePingResponseSchema);
    },

    checkout: async (body: CheckoutRequest): Promise<CheckoutResponse | ServiceError> => {
        const response = await fetchWithRetry(`${env.SOURCEBOT_LIGHTHOUSE_URL}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        return parseResponseBody(response, checkoutResponseSchema);
    },

    portal: async (body: PortalRequest): Promise<PortalResponse | ServiceError> => {
        const response = await fetchWithRetry(`${env.SOURCEBOT_LIGHTHOUSE_URL}/portal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        return parseResponseBody(response, portalResponseSchema);
    },

    invoices: async (body: InvoicesRequest): Promise<InvoicesResponse | ServiceError> => {
        const response = await fetchWithRetry(`${env.SOURCEBOT_LIGHTHOUSE_URL}/invoices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        return parseResponseBody(response, invoicesResponseSchema);
    },
}

const parseResponseBody = async <T extends z.ZodTypeAny>(
    response: Response,
    schema: T,
): Promise<z.infer<T> | ServiceError> => {
    let body: unknown;
    try {
        body = await response.json();
    } catch (error) {
        return {
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            errorCode: ErrorCode.INVALID_RESPONSE_BODY,
            message: `Failed to parse response body as JSON: ${error instanceof Error ? error.message : String(error)}`,
        };
    }

    if (isServiceError(body)) {
        return body;
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return {
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            errorCode: ErrorCode.INVALID_RESPONSE_BODY,
            message: `Response body failed schema validation: ${parsed.error.message}`,
        };
    }

    return parsed.data;
}
