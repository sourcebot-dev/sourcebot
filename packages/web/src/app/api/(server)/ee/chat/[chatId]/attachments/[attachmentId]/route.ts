import { sew } from "@/middleware/sew";
import { apiHandler } from "@/lib/apiHandler";
import { notFound, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuth } from "@/middleware/withAuth";
import { checkAskEntitlement, resolveChatAccess } from "@/features/chat/utils.server";
import { getStorageBackend } from "@sourcebot/shared";
import { NextRequest } from "next/server";
import { Readable } from "stream";

/**
 * Serves the bytes of a binary attachment. Two access paths:
 *
 *  1. The uploader can always read their own bytes. This covers the brief
 *     pre-commit window right after sending (before the `ChatAttachment` link
 *     exists), so a just-sent image renders straight from this route.
 *  2. Everyone else gets purely chat-derived access: they must be able to view
 *     the chat (owner / shared / public) AND a `ChatAttachment(chatId,
 *     attachmentId)` link must exist. The link requirement is what makes chat
 *     duplication safe (the same blob can be served only through chats it is
 *     actually linked to).
 */
export const GET = apiHandler(async (
    _req: NextRequest,
    { params }: { params: Promise<{ chatId: string; attachmentId: string }> },
) => {
    const { chatId, attachmentId } = await params;

    const response = await sew(() =>
        withOptionalAuth(async ({ org, user, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            const attachment = await prisma.attachment.findFirst({
                where: { id: attachmentId, orgId: org.id },
            });

            if (!attachment) {
                return notFound();
            }

            // Path 1: the uploader can always read their own bytes (pre-commit
            // preview window included).
            const isUploader = user !== undefined && attachment.uploadedById === user.id;

            if (!isUploader) {
                // Path 2: chat-derived access. The caller must be able to view
                // the chat AND the attachment must be linked to THIS chat, so a
                // blob can never be served via a chat it isn't linked to.
                const { canView } = await resolveChatAccess({ prisma, chat, user });
                if (!canView) {
                    return notFound();
                }

                const link = await prisma.chatAttachment.findUnique({
                    where: {
                        chatId_attachmentId: { chatId, attachmentId },
                    },
                    select: { id: true },
                });

                if (!link) {
                    return notFound();
                }
            }

            return { attachment };
        })
    );

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    const { attachment } = response;
    const storage = getStorageBackend();

    // Confirm the bytes exist before committing headers; a missing object would
    // otherwise surface as a stream error after a 200 is already sent.
    const stat = await storage.stat(attachment.storageKey);
    if (!stat) {
        return serviceErrorResponse(notFound());
    }

    const nodeStream = storage.createReadStream(attachment.storageKey);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    // Build a header-safe Content-Disposition: an ASCII fallback plus an
    // RFC 5987 UTF-8 form for the real filename.
    const asciiName = attachment.filename
        .replace(/[^\x20-\x7e]/g, '_')
        .replace(/["\\]/g, '_');
    const contentDisposition =
        `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`;

    return new Response(webStream, {
        headers: {
            'Content-Type': attachment.mediaType,
            // On-disk size, so the header always matches the streamed bytes.
            'Content-Length': stat.sizeBytes.toString(),
            'Content-Disposition': contentDisposition,
            // Never let the browser sniff a different (potentially executable)
            // content type from the bytes.
            'X-Content-Type-Options': 'nosniff',
            // Access is re-checked per request, so don't let the browser reuse
            // these bytes after a logout / share revocation / visibility change.
            'Cache-Control': 'private, no-store',
        },
    });
}, { track: false });
