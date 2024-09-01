"use server";

import { missingQueryParam } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";
import { NextRequest } from "next/server";
import { GetSourceResponse, pathQueryParamName, repoQueryParamName, ZoektPrintResponse } from "@/lib/types";
import { ZOEKT_WEBSERVER_URL } from "@/lib/environment";
import { createPathWithQueryParams } from "@/lib/utils";

/**
 * Returns the content of a source file at the given path.
 * 
 * Usage:
 * GET /api/source?path=<filepath>&repo=<repo>
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const filepath = searchParams.get(pathQueryParamName);
    const repo = searchParams.get(repoQueryParamName);

    if (!filepath) {
        return missingQueryParam(pathQueryParamName);
    }

    if (!repo) {
        return missingQueryParam(repoQueryParamName);
    }

    const url = createPathWithQueryParams(
        `${ZOEKT_WEBSERVER_URL}/print`,
        ["f", filepath],
        ["r", repo],
        ["format", "json"],
    );

    const res = await fetch(url);
    const data = await res.json() as ZoektPrintResponse;

    return Response.json(
        {
            content: data.Content,
            encoding: data.Encoding,
        } satisfies GetSourceResponse,
        {
            status: StatusCodes.OK
        }
    );
}
