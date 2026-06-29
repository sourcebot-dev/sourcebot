import { sew } from "@/middleware/sew";
import { apiHandler } from "@/lib/apiHandler";
import { ErrorCode } from "@/lib/errorCodes";
import { captureEvent } from "@/lib/posthog";
import { ServiceError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuth } from "@/middleware/withAuth";
import { checkAskEntitlement } from "@/features/chat/utils.server";
import { validateImageAttachment } from "@/features/chat/attachments/validation";
import { looksLikePdf, validatePdfAttachment } from "@/features/chat/attachments/pdfValidation";
import { sanitizeFilename } from "@/features/chat/attachments/filename";
import { env, getStorageBackend } from "@sourcebot/shared";
import { createHash, randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { NextRequest } from "next/server";

export const POST = apiHandler(async (req: NextRequest) => {
    // Reject obviously-oversized bodies before reading them into memory. The
    // multipart envelope adds some overhead beyond the raw bytes, so allow a
    // 1 MiB slack on top of the largest per-type cap; the exact (per-type) byte
    // cap is re-checked against the decoded buffer below.
    const maxImageBytes = env.SOURCEBOT_CHAT_ATTACHMENT_MAX_IMAGE_BYTES;
    const maxPdfBytes = env.SOURCEBOT_CHAT_ATTACHMENT_MAX_PDF_BYTES;
    const maxAttachmentBytes = Math.max(maxImageBytes, maxPdfBytes);
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > maxAttachmentBytes + 1024 * 1024) {
        return serviceErrorResponse({
            statusCode: StatusCodes.REQUEST_TOO_LONG,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: `Attachment exceeds the ${Math.round(maxAttachmentBytes / (1024 * 1024))}MB limit.`,
        } satisfies ServiceError);
    }

    const response = await sew(() =>
        // `withAuth` (not `withOptionalAuth`) so anonymous users cannot upload
        // binary attachments (a decision of the attachments design).
        withAuth(async ({ org, user, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const formData = await req.formData();
            const file = formData.get('file');
            if (!(file instanceof File)) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: 'Expected a `file` field in the multipart body.',
                } satisfies ServiceError;
            }

            // Authoritative size reject from the parsed file, independent of the
            // (best-effort, spoofable) content-length header, before buffering
            // the bytes into a Buffer. Use the largest per-type cap here; the
            // exact per-type cap is enforced by the type-specific validator.
            if (file.size > maxAttachmentBytes) {
                return {
                    statusCode: StatusCodes.REQUEST_TOO_LONG,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: `Attachment exceeds the ${Math.round(maxAttachmentBytes / (1024 * 1024))}MB limit.`,
                } satisfies ServiceError;
            }

            const buffer = Buffer.from(await file.arrayBuffer());

            // Authoritative content-type + size check by inspecting the bytes
            // (never the client-supplied MIME type or extension). PDFs are
            // sniffed by their `%PDF-` magic bytes; everything else is decoded
            // as an image. The persisted `mediaType` comes from the validator.
            const validation = looksLikePdf(buffer)
                ? validatePdfAttachment(buffer, maxPdfBytes)
                : await validateImageAttachment(buffer, maxImageBytes);
            if (!validation.ok) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: validation.reason,
                } satisfies ServiceError;
            }

            const { mediaType } = validation;
            const filename = sanitizeFilename(file.name || 'attachment');
            const sizeBytes = buffer.length;
            const checksum = createHash('sha256').update(buffer).digest('hex');
            const storageKey = `${org.id}/${randomUUID()}`;

            const storage = getStorageBackend();
            await storage.put(storageKey, buffer);

            let attachment;
            try {
                attachment = await prisma.attachment.create({
                    data: {
                        orgId: org.id,
                        storageKey,
                        filename,
                        mediaType,
                        sizeBytes,
                        checksum,
                        uploadedById: user.id,
                        status: 'PENDING',
                    },
                });
            } catch (error) {
                // Roll back the orphaned bytes if the DB row couldn't be written.
                await storage.delete(storageKey).catch(() => { /* best effort */ });
                throw error;
            }

            await captureEvent('chat_attachment_uploaded', {
                source: req.headers.get('X-Sourcebot-Client-Source') ?? 'unknown',
                mediaType,
                sizeBytes,
            });

            return {
                attachmentId: attachment.id,
                filename,
                mediaType,
                sizeBytes,
            };
        })
    );

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}, { track: false });
