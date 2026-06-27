'use client';

import {
    ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES,
    ATTACHMENT_ALLOWED_TEXT_EXTENSIONS,
    ATTACHMENT_ALLOWED_TEXT_MIME_TYPES,
    ATTACHMENT_MAX_COUNT,
    ATTACHMENT_MAX_IMAGE_BYTES,
    ATTACHMENT_MAX_TEXT_BYTES,
    ATTACHMENT_PASTE_AUTO_CONVERT_MIN_CHARS,
    ATTACHMENT_PASTE_AUTO_CONVERT_MIN_LINES,
} from "./constants";
import { AttachmentData } from "./types";
import { sanitizeFilename } from "./attachments/filename";
import { v4 as uuidv4 } from "uuid";

export { sanitizeFilename };

// A text attachment selected in the chat box but not yet submitted. The
// extracted text travels inline in the message (no upload).
export type PendingTextAttachment = {
    kind: 'text';
    id: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    text: string;
};

// An image attachment selected in the chat box. Unlike text, the bytes are
// uploaded to blob storage on select; `status`/`attachmentId` track that
// upload. `previewUrl` is a local object URL used for the pre-send thumbnail,
// and `file` is retained so the upload can be (re)issued.
export type PendingImageAttachment = {
    kind: 'image';
    id: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    previewUrl: string;
    file: File;
    status: 'uploading' | 'uploaded' | 'error';
    attachmentId?: string;
    error?: string;
};

// An attachment selected in the chat box but not yet submitted. The `id` is a
// client-only key for list rendering and removal; it is stripped before the
// attachment becomes part of a message.
export type PendingAttachment = PendingTextAttachment | PendingImageAttachment;

// Builds the comma-separated `accept` attribute for a native `<input type=file>`
// so the OS picker only surfaces supported file types. Image types are included
// only when the selected model can accept image input.
export const getAttachmentAcceptAttribute = (includeImages: boolean): string => {
    return [
        'text/*',
        ...ATTACHMENT_ALLOWED_TEXT_MIME_TYPES,
        ...ATTACHMENT_ALLOWED_TEXT_EXTENSIONS.map((extension) => `.${extension}`),
        ...(includeImages ? ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES : []),
    ].join(',');
}

// Builds the `accept` map for react-dropzone (and the native file picker) so
// the OS dialog and drag overlay only surface supported file types. The
// extension list is attached to `text/plain` so code files that report an empty
// or unusual MIME type are still selectable by extension. Image types are
// included only when the selected model can accept image input.
export const getAttachmentDropzoneAccept = (includeImages: boolean): Record<string, string[]> => {
    const accept: Record<string, string[]> = {
        'text/*': [],
        'text/plain': ATTACHMENT_ALLOWED_TEXT_EXTENSIONS.map((extension) => `.${extension}`),
    };
    for (const mimeType of ATTACHMENT_ALLOWED_TEXT_MIME_TYPES) {
        accept[mimeType] = [];
    }
    if (includeImages) {
        for (const mimeType of ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES) {
            accept[mimeType] = [];
        }
    }
    return accept;
}

// Converts a pending attachment into the message `AttachmentData` part. Returns
// `undefined` for an image whose upload has not completed (it must not be
// referenced before the blob exists); callers filter these out.
export const toAttachmentData = (attachment: PendingAttachment): AttachmentData | undefined => {
    if (attachment.kind === 'text') {
        return {
            kind: 'text',
            filename: attachment.filename,
            mediaType: attachment.mediaType,
            sizeBytes: attachment.sizeBytes,
            text: attachment.text,
        };
    }

    if (attachment.status === 'uploaded' && attachment.attachmentId) {
        return {
            kind: 'blob',
            attachmentId: attachment.attachmentId,
            filename: attachment.filename,
            mediaType: attachment.mediaType,
            sizeBytes: attachment.sizeBytes,
        };
    }

    return undefined;
}

const getExtension = (filename: string): string => {
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
}

export const isAllowedTextFile = (file: File): boolean => {
    if (file.type.startsWith('text/')) {
        return true;
    }
    if (ATTACHMENT_ALLOWED_TEXT_MIME_TYPES.includes(file.type)) {
        return true;
    }

    const extension = getExtension(file.name);
    if (ATTACHMENT_ALLOWED_TEXT_EXTENSIONS.includes(extension)) {
        return true;
    }

    // Files with no extension (e.g. "Dockerfile") report an empty extension;
    // fall back to matching the whole lowercased filename.
    const nameLower = file.name.toLowerCase();
    if (ATTACHMENT_ALLOWED_TEXT_EXTENSIONS.includes(nameLower)) {
        return true;
    }

    return false;
}

export const isAllowedImageFile = (file: File): boolean => {
    return (ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
}

const readAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsText(file);
    });
}

// Whether a plain-text paste is "large" enough to be automatically converted
// into a text attachment rather than inserted inline. Gated on both length and
// shape so a single long sentence isn't swept up, but a multi-line snippet is.
export const shouldAutoConvertPaste = (text: string): boolean => {
    if (text.length >= ATTACHMENT_PASTE_AUTO_CONVERT_MIN_CHARS) {
        return true;
    }
    return countLines(text) >= ATTACHMENT_PASTE_AUTO_CONVERT_MIN_LINES;
}

export const countLines = (text: string): number => {
    if (text.length === 0) {
        return 0;
    }
    return text.split('\n').length;
}

// Generates a non-colliding filename for an auto-converted paste, e.g.
// `pasted.txt`, then `pasted-2.txt`, `pasted-3.txt`, ...
const getPastedAttachmentFilename = (existing: PendingAttachment[]): string => {
    const used = new Set(existing.map((attachment) => attachment.filename));
    if (!used.has('pasted.txt')) {
        return 'pasted.txt';
    }

    let index = 2;
    while (used.has(`pasted-${index}.txt`)) {
        index++;
    }
    return `pasted-${index}.txt`;
}

export type CreatePastedAttachmentResult =
    | { ok: true; attachment: PendingAttachment }
    | { ok: false; error: string };

// Builds a pending text attachment from a pasted string, enforcing the same
// per-message count and per-attachment size caps as file attachments. Returns
// a human-readable error instead of throwing when a cap is exceeded.
export const createPastedTextAttachment = (
    text: string,
    existing: PendingAttachment[],
): CreatePastedAttachmentResult => {
    if (existing.length >= ATTACHMENT_MAX_COUNT) {
        return {
            ok: false,
            error: `You can attach at most ${ATTACHMENT_MAX_COUNT} files per message.`,
        };
    }

    const sizeBytes = new Blob([text]).size;
    if (sizeBytes > ATTACHMENT_MAX_TEXT_BYTES) {
        return {
            ok: false,
            error: `Pasted text exceeds the ${Math.round(ATTACHMENT_MAX_TEXT_BYTES / 1024)}KB limit.`,
        };
    }

    return {
        ok: true,
        attachment: {
            id: uuidv4(),
            kind: 'text',
            filename: getPastedAttachmentFilename(existing),
            mediaType: 'text/plain',
            sizeBytes,
            text,
        },
    };
}

export type ReadFilesResult = {
    attachments: PendingAttachment[];
    errors: string[];
};

// Reads and validates a set of files into pending attachments, enforcing the
// per-message count, per-file size, and allowed-type caps. Text files are read
// inline; image files (only when `allowImages`) are turned into pending image
// attachments with a local preview and an `uploading` status (the actual
// upload is kicked off by the caller). Rejected files produce a human-readable
// error message instead of throwing.
export const readFilesAsAttachments = async (
    files: File[],
    existingCount: number,
    { allowImages }: { allowImages: boolean },
): Promise<ReadFilesResult> => {
    const attachments: PendingAttachment[] = [];
    const errors: string[] = [];
    let count = existingCount;

    for (const file of files) {
        if (count >= ATTACHMENT_MAX_COUNT) {
            errors.push(`You can attach at most ${ATTACHMENT_MAX_COUNT} files per message.`);
            break;
        }

        if (isAllowedTextFile(file)) {
            if (file.size > ATTACHMENT_MAX_TEXT_BYTES) {
                errors.push(`${file.name}: exceeds the ${Math.round(ATTACHMENT_MAX_TEXT_BYTES / 1024)}KB limit.`);
                continue;
            }
            try {
                const text = await readAsText(file);
                attachments.push({
                    id: uuidv4(),
                    kind: 'text',
                    filename: sanitizeFilename(file.name),
                    mediaType: file.type || 'text/plain',
                    sizeBytes: file.size,
                    text,
                });
                count++;
            } catch {
                errors.push(`${file.name}: failed to read file.`);
            }
            continue;
        }

        if (isAllowedImageFile(file)) {
            if (!allowImages) {
                errors.push(`${file.name}: the selected model does not support image input.`);
                continue;
            }
            if (file.size > ATTACHMENT_MAX_IMAGE_BYTES) {
                errors.push(`${file.name}: exceeds the ${Math.round(ATTACHMENT_MAX_IMAGE_BYTES / (1024 * 1024))}MB image limit.`);
                continue;
            }
            attachments.push({
                id: uuidv4(),
                kind: 'image',
                filename: sanitizeFilename(file.name),
                mediaType: file.type,
                sizeBytes: file.size,
                previewUrl: URL.createObjectURL(file),
                file,
                status: 'uploading',
            });
            count++;
            continue;
        }

        errors.push(`${file.name}: unsupported file type.`);
    }

    return { attachments, errors };
}

// Uploads an image attachment's bytes to blob storage, returning the committed
// attachment metadata (including the server-assigned `attachmentId`). Throws
// with a human-readable message on failure.
export const uploadImageAttachment = async (file: File): Promise<{
    attachmentId: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
}> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/ee/chat/attachments', {
        method: 'POST',
        body: formData,
        headers: {
            'X-Sourcebot-Client-Source': 'sourcebot-web-client',
        },
    });

    if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.message ?? 'Failed to upload image.');
    }

    return response.json();
}
