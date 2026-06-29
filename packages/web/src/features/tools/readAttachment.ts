import { z } from "zod";
import { ToolDefinition } from "./types";
import { ARTIFACT_READ_MAX_LINES, readArtifactContent } from "./artifactReader";
import { logger } from "./logger";
import description from "./readAttachment.txt";

const readAttachmentShape = {
    attachmentId: z.string().describe("The id of the attachment to read, as listed in the attachments manifest."),
    offset: z.number().int().positive()
        .optional()
        .describe("Line number to start reading from (1-indexed). Omit to start from the beginning."),
    limit: z.number().int().positive()
        .optional()
        .describe(`Maximum number of lines to read (max: ${ARTIFACT_READ_MAX_LINES}). Omit to read up to ${ARTIFACT_READ_MAX_LINES} lines.`),
};

export type ReadAttachmentMetadata = {
    attachmentId: string;
    filename: string;
    mediaType: string;
    startLine: number;
    endLine: number;
    isTruncated: boolean;
};

export const readAttachmentDefinition: ToolDefinition<"read_attachment", typeof readAttachmentShape, ReadAttachmentMetadata> = {
    name: "read_attachment",
    title: "Read attachment",
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: z.object(readAttachmentShape),
    execute: async ({ attachmentId, offset, limit }, context) => {
        logger.debug('read_attachment', { attachmentId, offset, limit });

        const attachment = context.getAttachment?.(attachmentId);
        if (!attachment) {
            throw new Error(`Attachment "${attachmentId}" not found. Use an id from the attachments manifest.`);
        }

        const header = [
            `<filename>${attachment.filename}</filename>`,
            `<media-type>${attachment.mediaType}</media-type>`,
        ].join('\n');

        const { output, startLine, endLine, isTruncated } = readArtifactContent({
            content: attachment.text,
            header,
            offset,
            limit,
        });

        const metadata: ReadAttachmentMetadata = {
            attachmentId,
            filename: attachment.filename,
            mediaType: attachment.mediaType,
            startLine,
            endLine,
            isTruncated,
        };

        return {
            output,
            metadata,
            sources: [{
                type: 'attachment',
                attachmentId,
                name: attachment.filename,
                mediaType: attachment.mediaType,
            }],
        };
    },
};
