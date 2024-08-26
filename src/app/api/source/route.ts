"use server";

import { ErrorCode } from "@/lib/errorCodes";
import { serviceError, missingQueryParam } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";
import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { GetSourceResponse, pathQueryParamName, repoQueryParamName } from "@/lib/api";


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

    // Get the contents of the path
    const repoPath = getRepoPath(repo);
    if (!repoPath) {
        return serviceError({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.REPOSITORY_NOT_FOUND,
            message: `Could not find repository '${repo}'.`
        });
    }

    const fullPath = path.join(repoPath, filepath);
    if (!fs.existsSync(fullPath)) {
        return serviceError({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.FILE_NOT_FOUND,
            message: `Could not find file '${filepath}' in repository '${repo}'.`
        });
    }

    // @todo : some error handling here would be nice
    const content = fs.readFileSync(fullPath, "utf8");

    return Response.json(
        {
            content,
        } satisfies GetSourceResponse,
        {
            status: StatusCodes.OK
        }
    );
}

// @todo : we will need to figure out a more sophisticated system for this..
const getRepoPath = (repo: string): string | undefined => {
    switch (repo) {
        case "monorepo":
            return "/Users/brendan/monorepo"
    }
    
    return undefined;
}