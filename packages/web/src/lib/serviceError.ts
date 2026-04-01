import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "./errorCodes";
import { z, ZodError } from "zod";

export const serviceErrorSchema = z.object({
    statusCode: z.number(),
    errorCode: z.string(),
    message: z.string(),
});

export type ServiceError = z.infer<typeof serviceErrorSchema>;

/**
 * Useful for throwing errors and handling them in error boundaries.
 */
export class ServiceErrorException extends Error {
    constructor(public readonly serviceError: ServiceError) {
        super(JSON.stringify(serviceError));
    }
}

export const serviceErrorResponse = ({ statusCode, errorCode, message }: ServiceError) => {
    return Response.json({
        statusCode,
        errorCode,
        message,
    }, {
        status: statusCode,
    });
}

export const missingQueryParam = (name: string): ServiceError => {
    return {
        statusCode: StatusCodes.BAD_REQUEST,
        errorCode: ErrorCode.MISSING_REQUIRED_QUERY_PARAMETER,
        message: `Missing required query parameter: ${name}`,
    };
}

export const requestBodySchemaValidationError = (error: ZodError): ServiceError => {
    return {
        statusCode: StatusCodes.BAD_REQUEST,
        errorCode: ErrorCode.INVALID_REQUEST_BODY,
        message: `Schema validation failed with: ${error.message}`,
    };
}

export const queryParamsSchemaValidationError = (error: ZodError): ServiceError => {
    return {
        statusCode: StatusCodes.BAD_REQUEST,
        errorCode: ErrorCode.INVALID_QUERY_PARAMS,
        message: `Query params validation failed with: ${error.message}`,
    };
}

export const fileNotFound = (fileName: string, repository: string): ServiceError => {
    return {
        statusCode: StatusCodes.NOT_FOUND,
        errorCode: ErrorCode.FILE_NOT_FOUND,
        message: `File "${fileName}" not found in repository "${repository}"`,
    };
}

export const unexpectedError = (message: string): ServiceError => {
    return {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        errorCode: ErrorCode.UNEXPECTED_ERROR,
        message: `Unexpected error: ${message}`,
    };
}

export const notAuthenticated = (): ServiceError => {
    return {
        statusCode: StatusCodes.UNAUTHORIZED,
        errorCode: ErrorCode.NOT_AUTHENTICATED,
        message: "Not authenticated",
    }
}

export const notFound = (message?: string): ServiceError => {
    return {
        statusCode: StatusCodes.NOT_FOUND,
        errorCode: ErrorCode.NOT_FOUND,
        message: message ?? "Not found",
    }
}

export const userNotFound = (): ServiceError => {
    return {
        statusCode: StatusCodes.NOT_FOUND,
        errorCode: ErrorCode.USER_NOT_FOUND,
        message: "User not found",
    }
}

export const orgNotFound = (): ServiceError => {
    return {
        statusCode: StatusCodes.NOT_FOUND,
        errorCode: ErrorCode.ORG_NOT_FOUND,
        message: "Organization not found",
    }
}

export const invalidGitRef = (ref: string): ServiceError => {
    return {
        statusCode: StatusCodes.BAD_REQUEST,
        errorCode: ErrorCode.INVALID_GIT_REF,
        message: `Invalid git reference: "${ref}". Git refs cannot start with '-'.`,
    };
}

