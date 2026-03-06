import { ErrorCode } from "@/lib/errorCodes"
import { ServiceError } from "@/lib/serviceError"
import { StatusCodes } from "http-status-codes"
import { NextResponse } from "next/server"

// Repeat for other methods or use a handler:
const handler = () => NextResponse.json(
    {
        statusCode: StatusCodes.NOT_FOUND,
        errorCode: ErrorCode.NOT_FOUND,
        message: "This API endpoint does not exist",
    } satisfies ServiceError,
    { status: 404 }
  )
  
  export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }