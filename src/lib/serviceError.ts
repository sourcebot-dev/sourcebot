import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "./errorCodes";

export interface ServiceErrorArgs {
    statusCode: StatusCodes;
    errorCode: ErrorCode;
    message: string;
}

export const serviceError = ({ statusCode, errorCode, message }: ServiceErrorArgs) => {
    return Response.json({
        statusCode,
        errorCode,
        message,
    }, {
        status: statusCode,
    });
}

export const missingQueryParam = (name: string) => {
    return serviceError({
        statusCode: StatusCodes.BAD_REQUEST,
        errorCode: ErrorCode.MISSING_REQUIRED_QUERY_PARAMETER,
        message: `Missing required query parameter: ${name}`,
    });
}