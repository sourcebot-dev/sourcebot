'use client';

import {
    ATTACHMENT_ALLOWED_TEXT_EXTENSIONS,
    ATTACHMENT_ALLOWED_TEXT_MIME_TYPES,
    ATTACHMENT_MAX_COUNT,
    ATTACHMENT_MAX_FILENAME_LENGTH,
    ATTACHMENT_MAX_TEXT_BYTES,
} from "./constants";
import { AttachmentData, TextAttachment } from "./types";

// Normalizes an untrusted filename: keeps only the basename, drops control
// characters (which could break the prompt's `<attachment filename="...">` tag
// or the UI), collapses whitespace, and caps the length while preserving the
// extension. Long/abusive names are truncated rather than rejected.
export const sanitizeFilename = (name: string): string => {
    const basename = name.split(/[\\/]/).pop() ?? name;
    const cleaned = Array.from(basename)
        .filter((char) => {
            const code = char.charCodeAt(0);
            return code >= 32 && code !== 127;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim() || 'attachment';

    if (cleaned.length <= ATTACHMENT_MAX_FILENAME_LENGTH) {
        return cleaned;
    }

    const dotIndex = cleaned.lastIndexOf('.');
    const extension = dotIndex > 0 ? cleaned.slice(dotIndex) : '';
    const stem = dotIndex > 0 ? cleaned.slice(0, dotIndex) : cleaned;
    const keep = Math.max(1, ATTACHMENT_MAX_FILENAME_LENGTH - extension.length - 1);
    return `${stem.slice(0, keep)}…${extension}`;
}

// A text attachment selected in the chat box but not yet submitted. The `id`
// is a client-only key for list rendering and removal; it is stripped before
// the attachment becomes part of a message.
export type PendingAttachment = TextAttachment & { id: string };

// Builds the comma-separated `accept` attribute for a native `<input type=file>`
// so the OS picker only surfaces supported text file types.
export const getAttachmentAcceptAttribute = (): string => {
    return [
        'text/*',
        ...ATTACHMENT_ALLOWED_TEXT_MIME_TYPES,
        ...ATTACHMENT_ALLOWED_TEXT_EXTENSIONS.map((extension) => `.${extension}`),
    ].join(',');
}

// Builds the `accept` map for react-dropzone (and the native file picker) so
// the OS dialog and drag overlay only surface supported text file types. The
// extension list is attached to `text/plain` so code files that report an empty
// or unusual MIME type are still selectable by extension.
export const getAttachmentDropzoneAccept = (): Record<string, string[]> => {
    const accept: Record<string, string[]> = {
        'text/*': [],
        'text/plain': ATTACHMENT_ALLOWED_TEXT_EXTENSIONS.map((extension) => `.${extension}`),
    };
    for (const mimeType of ATTACHMENT_ALLOWED_TEXT_MIME_TYPES) {
        accept[mimeType] = [];
    }
    return accept;
}

export const toAttachmentData = (attachment: PendingAttachment): AttachmentData => {
    return {
        kind: attachment.kind,
        filename: attachment.filename,
        mediaType: attachment.mediaType,
        sizeBytes: attachment.sizeBytes,
        text: attachment.text,
    };
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

const readAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsText(file);
    });
}

export type ReadFilesResult = {
    attachments: PendingAttachment[];
    errors: string[];
};

// Reads and validates a set of files into pending text attachments, enforcing
// the per-message count, per-file size, and allowed-type caps. Rejected files
// produce a human-readable error message instead of throwing.
export const readFilesAsAttachments = async (
    files: File[],
    existingCount: number,
): Promise<ReadFilesResult> => {
    const attachments: PendingAttachment[] = [];
    const errors: string[] = [];
    let count = existingCount;

    for (const file of files) {
        if (count >= ATTACHMENT_MAX_COUNT) {
            errors.push(`You can attach at most ${ATTACHMENT_MAX_COUNT} files per message.`);
            break;
        }

        if (!isAllowedTextFile(file)) {
            errors.push(`${file.name}: unsupported file type (text files only).`);
            continue;
        }

        if (file.size > ATTACHMENT_MAX_TEXT_BYTES) {
            errors.push(`${file.name}: exceeds the ${Math.round(ATTACHMENT_MAX_TEXT_BYTES / 1024)}KB limit.`);
            continue;
        }

        try {
            const text = await readAsText(file);
            attachments.push({
                id: crypto.randomUUID(),
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
    }

    return { attachments, errors };
}
