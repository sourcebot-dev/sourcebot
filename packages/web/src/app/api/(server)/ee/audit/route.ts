'use server';

import { NextRequest } from "next/server";
import { fetchAuditRecords } from "@/ee/features/audit/actions";
import { isServiceError } from "@/lib/utils";
import { serviceErrorResponse } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { env } from "@/env.mjs";
import { getEntitlements } from "@sourcebot/shared";

export const GET = async (request: NextRequest) => {
  const domain = request.headers.get("X-Org-Domain");
  const apiKey = request.headers.get("X-Sourcebot-Api-Key") ?? undefined;

  if (!domain) {
    return serviceErrorResponse({
      statusCode: StatusCodes.BAD_REQUEST,
      errorCode: ErrorCode.MISSING_ORG_DOMAIN_HEADER,
      message: "Missing X-Org-Domain header",
    });
  } 

  if (env.SOURCEBOT_EE_AUDIT_LOGGING_ENABLED === 'false') {
    return serviceErrorResponse({
      statusCode: StatusCodes.NOT_FOUND,
      errorCode: ErrorCode.NOT_FOUND,
      message: "Audit logging is not enabled",
    });
  }

  const entitlements = getEntitlements();
  if (!entitlements.includes('audit')) {
    return serviceErrorResponse({
      statusCode: StatusCodes.FORBIDDEN,
      errorCode: ErrorCode.NOT_FOUND,
      message: "Audit logging is not enabled for your license",
    });
  }

  const result = await fetchAuditRecords(domain, apiKey);
  if (isServiceError(result)) {
    return serviceErrorResponse(result);
  }
  return Response.json(result);
}; 