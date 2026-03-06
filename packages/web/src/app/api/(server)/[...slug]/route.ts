import { ErrorCode } from "@/lib/errorCodes"
import { serviceErrorResponse } from "@/lib/serviceError"
import { StatusCodes } from "http-status-codes"

const handler = () => {
    return serviceErrorResponse({
        statusCode: StatusCodes.NOT_FOUND,
        errorCode: ErrorCode.NOT_FOUND,
        message: "This API endpoint does not exist",
    });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }