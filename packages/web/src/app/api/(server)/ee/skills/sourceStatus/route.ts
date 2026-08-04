'use server';

import { getAgentSkillSourceStatus } from "@/ee/features/chat/skills/actions";
import type { AgentSkillSourceStatus } from "@/ee/features/chat/skills/types";
import { apiHandler } from "@/lib/apiHandler";
import { queryParamsSchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { z } from "zod";

export type SkillSourceStatusResponse = { status: AgentSkillSourceStatus };

const querySchema = z.object({
    skillId: z.string().min(1),
});

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to getAgentSkillSourceStatus() which calls withAuth
export const GET = apiHandler(async (request: NextRequest) => {
    const parsed = querySchema.safeParse({
        skillId: request.nextUrl.searchParams.get('skillId') ?? undefined,
    });

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const result = await getAgentSkillSourceStatus(parsed.data.skillId);

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
