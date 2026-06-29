'use client';

import {
    ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES,
    ATTACHMENT_ALLOWED_PDF_MIME_TYPES,
    ATTACHMENT_ALLOWED_TEXT_EXTENSIONS,
    ATTACHMENT_ALLOWED_TEXT_MIME_TYPES,
    ATTACHMENT_MAX_IMAGE_BYTES,
    ATTACHMENT_MAX_IMAGE_COUNT,
    ATTACHMENT_MAX_PDF_BYTES,
    ATTACHMENT_MAX_PDF_COUNT,
    ATTACHMENT_MAX_TURN_TEXT_BYTES,
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

// A PDF attachment selected in the chat box. Like images, the bytes are
// uploaded to blob storage on select and `status`/`attachmentId` track that
// upload. Unlike images there is no `previewUrl` (PDFs are not rendered as a
// thumbnail); the tray shows a file-icon chip instead.
export type PendingPdfAttachment = {
    kind: 'pdf';
    id: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    file: File;
    status: 'uploading' | 'uploaded' | 'error';
    attachmentId?: string;
    error?: string;
};

// An attachment selected in the chat box but not yet submitted. For text
// attachments the `id` is the stable handle carried into the message so the
// content can be cited and resolved; for images and PDFs it is a client-only
// list key (they are addressed by their uploaded `attachmentId` instead).
export type PendingAttachment = PendingTextAttachment | PendingImageAttachment | PendingPdfAttachment;

// Whether a pending attachment is an upload-backed blob (image or PDF): its
// bytes are uploaded on select and it carries an `attachmentId`/`status`.
export type PendingUploadAttachment = PendingImageAttachment | PendingPdfAttachment;

export const isPendingUploadAttachment = (
    attachment: PendingAttachment,
): attachment is PendingUploadAttachment =>
    attachment.kind === 'image' || attachment.kind === 'pdf';

// Builds the comma-separated `accept` attribute for a native `<input type=file>`
// so the OS picker only surfaces supported file types. Image types are included
// only when the selected model can accept image input; PDF only when it
// natively supports PDF documents.
export const getAttachmentAcceptAttribute = (includeImages: boolean, includePdf: boolean): string => {
    return [
        'text/*',
        ...ATTACHMENT_ALLOWED_TEXT_MIME_TYPES,
        ...ATTACHMENT_ALLOWED_TEXT_EXTENSIONS.map((extension) => `.${extension}`),
        ...(includeImages ? ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES : []),
        ...(includePdf ? [...ATTACHMENT_ALLOWED_PDF_MIME_TYPES, '.pdf'] : []),
    ].join(',');
}

// Builds the `accept` map for react-dropzone (and the native file picker) so
// the OS dialog and drag overlay only surface supported file types. The
// extension list is attached to `text/plain` so code files that report an empty
// or unusual MIME type are still selectable by extension. Image types are
// included only when the selected model can accept image input; PDF only when
// it natively supports PDF documents.
export const getAttachmentDropzoneAccept = (includeImages: boolean, includePdf: boolean): Record<string, string[]> => {
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
    if (includePdf) {
        for (const mimeType of ATTACHMENT_ALLOWED_PDF_MIME_TYPES) {
            accept[mimeType] = ['.pdf'];
        }
    }
    return accept;
}

// Total UTF-8 byte size of a turn's submitted text (prompt + text attachment
// bodies), checked against ATTACHMENT_MAX_TURN_TEXT_BYTES at submit time. Image
// attachments are excluded: their bytes are uploaded as blobs, not inlined into
// the message text, so they don't count against the inline-text budget.
export const getSubmittedTextBytes = (text: string, attachments: PendingAttachment[]): number => {
    const textBytes = new TextEncoder().encode(text).length;
    const attachmentBytes = attachments
        .filter((attachment) => attachment.kind === 'text')
        .reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
    return textBytes + attachmentBytes;
}

// Converts a pending attachment into the message `AttachmentData` part. Returns
// `undefined` for an image whose upload has not completed (it must not be
// referenced before the blob exists); callers filter these out.
export const toAttachmentData = (attachment: PendingAttachment): AttachmentData | undefined => {
    if (attachment.kind === 'text') {
        return {
            kind: 'text',
            id: attachment.id,
            filename: attachment.filename,
            mediaType: attachment.mediaType,
            sizeBytes: attachment.sizeBytes,
            text: attachment.text,
        };
    }

    // Images and PDFs both become blob refs once their upload completes; an
    // upload still in flight has no `attachmentId` and must not be referenced.
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

export const isAllowedPdfFile = (file: File): boolean => {
    if ((ATTACHMENT_ALLOWED_PDF_MIME_TYPES as readonly string[]).includes(file.type)) {
        return true;
    }
    // Some browsers report an empty type for PDFs; fall back to the extension.
    return getExtension(file.name) === 'pdf';
}

const readAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsText(file);
    });
}

// Whether a plain-text paste is large enough to auto-convert into an attachment
// instead of being inserted inline. Gated on length or line count.
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

// Builds a pending text attachment from a pasted string. The per-turn text
// budget is enforced once at submit time, not here, so this can't fail.
export const createPastedTextAttachment = (
    text: string,
    existing: PendingAttachment[],
): PendingAttachment => {
    return {
        id: uuidv4(),
        kind: 'text',
        filename: getPastedAttachmentFilename(existing),
        mediaType: 'text/plain',
        sizeBytes: new Blob([text]).size,
        text,
    };
}

export type ReadFilesResult = {
    attachments: PendingAttachment[];
    errors: string[];
};

// Reads and validates files into pending attachments, enforcing the per-file
// size, allowed-type, and per-message image/PDF-count caps (the per-turn text
// budget is enforced at submit time). Text is read inline; images (when
// `allowImages`) and PDFs (when `allowPdf`) become pending uploads the caller
// then kicks off. The count caps mirror the server's for early feedback.
// Rejected files yield an error, not a throw.
export const readFilesAsAttachments = async (
    files: File[],
    {
        allowImages,
        allowPdf,
        existingImageCount = 0,
        existingPdfCount = 0,
        maxImageBytes = ATTACHMENT_MAX_IMAGE_BYTES,
        maxPdfBytes = ATTACHMENT_MAX_PDF_BYTES,
    }: {
        allowImages: boolean;
        allowPdf: boolean;
        existingImageCount?: number;
        existingPdfCount?: number;
        maxImageBytes?: number;
        maxPdfBytes?: number;
    },
): Promise<ReadFilesResult> => {
    const attachments: PendingAttachment[] = [];
    const errors: string[] = [];
    let imageCount = existingImageCount;
    let pdfCount = existingPdfCount;

    for (const file of files) {
        if (isAllowedTextFile(file)) {
            // Skip before reading to avoid loading a huge file into memory.
            if (file.size > ATTACHMENT_MAX_TURN_TEXT_BYTES) {
                errors.push(`${file.name}: exceeds the ${Math.round(ATTACHMENT_MAX_TURN_TEXT_BYTES / 1024)}KB per-message limit.`);
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
            if (file.size > maxImageBytes) {
                errors.push(`${file.name}: exceeds the ${Math.round(maxImageBytes / (1024 * 1024))}MB image limit.`);
                continue;
            }
            if (imageCount >= ATTACHMENT_MAX_IMAGE_COUNT) {
                errors.push(`You can attach at most ${ATTACHMENT_MAX_IMAGE_COUNT} images per message.`);
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
            imageCount++;
            continue;
        }

        if (isAllowedPdfFile(file)) {
            if (!allowPdf) {
                errors.push(`${file.name}: the selected model does not support PDF input.`);
                continue;
            }
            if (file.size > maxPdfBytes) {
                errors.push(`${file.name}: exceeds the ${Math.round(maxPdfBytes / (1024 * 1024))}MB PDF limit.`);
                continue;
            }
            if (pdfCount >= ATTACHMENT_MAX_PDF_COUNT) {
                errors.push(`You can attach at most ${ATTACHMENT_MAX_PDF_COUNT} PDFs per message.`);
                continue;
            }
            attachments.push({
                id: uuidv4(),
                kind: 'pdf',
                filename: sanitizeFilename(file.name),
                mediaType: 'application/pdf',
                sizeBytes: file.size,
                file,
                status: 'uploading',
            });
            pdfCount++;
            continue;
        }

        errors.push(`${file.name}: unsupported file type.`);
    }

    return { attachments, errors };
}

// Uploads a binary (blob) attachment's bytes to blob storage, returning the
// committed attachment metadata (including the server-assigned `attachmentId`).
// Used for both image and PDF attachments. Throws with a human-readable message
// on failure.
export const uploadBlobAttachment = async (file: File): Promise<{
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
        throw new Error(body?.message ?? 'Failed to upload file.');
    }

    return response.json();
}
