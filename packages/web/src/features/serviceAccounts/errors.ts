import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";

export const serviceAccountNotFoundError = (): ServiceError => ({
    statusCode: StatusCodes.NOT_FOUND,
    errorCode: ErrorCode.SERVICE_ACCOUNT_NOT_FOUND,
    message: "Service account not found",
});
