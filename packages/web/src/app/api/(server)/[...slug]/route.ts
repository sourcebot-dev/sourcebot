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

// eslint-disable-next-line authz/require-auth-wrapper -- 404 catch-all for unknown API endpoints, returns no user data
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }