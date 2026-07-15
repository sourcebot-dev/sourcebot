import { fetchWithRetry, isServiceError } from "@/lib/utils";
import { env } from "@sourcebot/shared";
import {
    ActivateRequest,
    ActivateResponse,
    activateResponseSchema,
    CheckoutRequest,
    CheckoutResponse,
    checkoutResponseSchema,
    ClaimActivationCodeRequest,
    ClaimActivationCodeResponse,
    claimActivationCodeResponseSchema,
    InvoicesRequest,
    InvoicesResponse,
    invoicesResponseSchema,
    OffersQuery,
    OffersResponse,
    offersResponseSchema,
    PortalRequest,
    PortalResponse,
    portalResponseSchema,
    ServicePingRequest,
    ServicePingResponse,
    servicePingResponseSchema,
} from "@sourcebot/shared/client";
import { lighthouseUnreachable, ServiceError } from "@/lib/serviceError";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

const requestLighthouse = async <T extends z.ZodTypeAny>(
    path: string,
    init: RequestInit,
    schema: T,
    retryOptions: { retries?: number; backoffMs?: number } = {},
): Promise<z.infer<T> | ServiceError> => {
    const url = `${env.SOURCEBOT_LIGHTHOUSE_URL}${path}`;

    let response: Response;
    try {
        response = await fetchWithRetry(url, init, retryOptions)
    } catch (error) {
        return lighthouseUnreachable(url, error);
    }

    return parseResponseBody(response, schema);
}

const jsonPost = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

export const client = {
    activate: (body: ActivateRequest): Promise<ActivateResponse | ServiceError> => {
        return requestLighthouse('/activate', jsonPost(body), activateResponseSchema);
    },

    claimActivationCode: (body: ClaimActivationCodeRequest): Promise<ClaimActivationCodeResponse | ServiceError> => {
        return requestLighthouse('/claim-activation-code', jsonPost(body), claimActivationCodeResponseSchema);
    },

    ping: (body: ServicePingRequest): Promise<ServicePingResponse | ServiceError> => {
        return requestLighthouse('/ping', jsonPost(body), servicePingResponseSchema);
    },

    pingSchema: (): Promise<Record<string, unknown> | ServiceError> => {
        return requestLighthouse('/schema', { method: 'GET' }, z.record(z.string(), z.unknown()));
    },

    checkout: (body: CheckoutRequest): Promise<CheckoutResponse | ServiceError> => {
        return requestLighthouse('/checkout', jsonPost(body), checkoutResponseSchema);
    },

    portal: (body: PortalRequest): Promise<PortalResponse | ServiceError> => {
        return requestLighthouse('/portal', jsonPost(body), portalResponseSchema);
    },

    invoices: (body: InvoicesRequest): Promise<InvoicesResponse | ServiceError> => {
        return requestLighthouse('/invoices', jsonPost(body), invoicesResponseSchema);
    },

    offers: (query: OffersQuery): Promise<OffersResponse | ServiceError> => {
        const params = new URLSearchParams(query);
        return requestLighthouse(`/offers?${params}`, { method: 'GET' }, offersResponseSchema, { retries: 0});
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
