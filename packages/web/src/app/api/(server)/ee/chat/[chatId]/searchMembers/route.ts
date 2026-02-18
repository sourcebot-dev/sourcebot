import { apiHandler } from "@/lib/apiHandler";
import { SOURCEBOT_GUEST_USER_ID } from "@/lib/constants";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, queryParamsSchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuthV2 } from "@/withAuthV2";
import { env, hasEntitlement } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";
import { NextRequest } from "next/server";
import { z } from "zod";

const searchMembersQueryParamsSchema = z.object({
    query: z.string().default(''),
});

export type SearchChatShareableMembersQueryParams = z.infer<typeof searchMembersQueryParamsSchema>;

export type SearchChatShareableMembersResponse = {
    id: string;
    email?: string;
    name?: string;
    image?: string;
}[];

/**
 * non-paginated api that returns all members of a org that
 * do _not_ already have access to the chat. Used for
 * recommending users to share a chat with.
 */
export const GET = apiHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) => {
    // Disable this API for the askgh experiment since we
    // don't want to allow users to search other members.
    if (env.EXPERIMENT_ASK_GH_ENABLED === 'true') {
        return serviceErrorResponse({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.UNEXPECTED_ERROR,
            message: "This API is not enabled with this experiment.",
        })
    }

    if (!hasEntitlement('chat-sharing')) {
        return serviceErrorResponse({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.UNEXPECTED_ERROR,
            message: "Chat sharing is not enabled for your license",
        })
    }

    const { chatId } = await params;

    const rawParams = Object.fromEntries(
        Object.keys(searchMembersQueryParamsSchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined
        ])
    );
    const parsed = searchMembersQueryParamsSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const { query } = parsed.data;


    const result = await withAuthV2(async ({ org, user, prisma }) => {
        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        // Only the creator can search for members to share with
        if (chat.createdById !== user.id) {
            return notFound();
        }

        // Get existing shares to exclude
        const sharedWithUsers = await prisma.chatAccess.findMany({
            where: { chatId },
            select: { userId: true },
        });

        const excludeUserIds = new Set([
            // Exclude the owner
            user.id,
            // ... and the guest user
            SOURCEBOT_GUEST_USER_ID,
            // ... as well as any existing
            ...sharedWithUsers.map((s) => s.userId),
        ]);

        // Search org members
        const members = await prisma.userToOrg.findMany({
            where: {
                orgId: org.id,
                userId: {
                    notIn: Array.from(excludeUserIds),
                },
                user: {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { email: { contains: query, mode: 'insensitive' } },
                    ],
                },
            },
            include: {
                user: true,
            },
        });

        return members.map((member) => ({
            id: member.userId,
            email: member.user.email ?? undefined,
            name: member.user.name ?? undefined,
            image: member.user.image ?? undefined,
        }));
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
