import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse, queryParamsSchemaValidationError } from "@/lib/serviceError";
import { listChatsQueryParamsSchema, ListChatsResponse } from "./types";
import { isServiceError } from "@/lib/utils";
import { withAuth } from "@/middleware/withAuth";
import { NextRequest } from "next/server";

export const GET = apiHandler(async (request: NextRequest) => {
    const rawParams = Object.fromEntries(
        Object.keys(listChatsQueryParamsSchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined
        ])
    );
    const parsed = listChatsQueryParamsSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const { cursor, limit, query, sortBy, sortOrder } = parsed.data;

    const result = await withAuth(async ({ org, user, prisma }): Promise<ListChatsResponse> => {
        const chats = await prisma.chat.findMany({
            where: {
                orgId: org.id,
                createdById: user.id,
                ...(query ? {
                    name: {
                        contains: query,
                        mode: "insensitive" as const,
                    },
                } : {}),
            },
            orderBy: [
                { [sortBy]: sortOrder },
                { id: "asc" },
            ],
            take: limit + 1,
            ...(cursor ? {
                cursor: { id: cursor },
                skip: 1,
            } : {}),
            select: {
                id: true,
                name: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        const hasMore = chats.length > limit;
        const items = hasMore ? chats.slice(0, limit) : chats;
        const nextCursor = hasMore ? items[items.length - 1].id : null;

        return {
            chats: items.map(chat => ({
                ...chat,
                createdAt: chat.createdAt.toISOString(),
                updatedAt: chat.updatedAt.toISOString(),
            })),
            nextCursor,
        };
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
