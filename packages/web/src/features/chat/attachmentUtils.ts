'use client';

import {
    ATTACHMENT_ALLOWED_TEXT_EXTENSIONS,
    ATTACHMENT_ALLOWED_TEXT_MIME_TYPES,
    ATTACHMENT_MAX_TURN_TEXT_BYTES,
    ATTACHMENT_PASTE_AUTO_CONVERT_MIN_CHARS,
    ATTACHMENT_PASTE_AUTO_CONVERT_MIN_LINES,
} from "./constants";
import { AttachmentData, TextAttachment } from "./types";
import { v4 as uuidv4 } from "uuid";

// Normalizes an untrusted filename: basename only, strips control chars (which
// could break the `<attachment filename="...">` tag or UI), collapses whitespace.
export const sanitizeFilename = (name: string): string => {
    const basename = name.split(/[\\/]/).pop() ?? name;
    return Array.from(basename)
        .filter((char) => {
            const code = char.charCodeAt(0);
            return code >= 32 && code !== 127;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim() || 'attachment';
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

// Builds react-dropzone's `accept` map. Extensions are attached to `text/plain`
// so code files that report an empty/unusual MIME type are still selectable.
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

// Total UTF-8 byte size of a turn's submitted text (prompt + attachment bodies),
// checked against ATTACHMENT_MAX_TURN_TEXT_BYTES at submit time.
export const getSubmittedTextBytes = (text: string, attachments: PendingAttachment[]): number => {
    const textBytes = new TextEncoder().encode(text).length;
    const attachmentBytes = attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
    return textBytes + attachmentBytes;
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

// Reads files into pending text attachments, rejecting non-text files and any
// file larger than the per-turn budget (skipped before reading to avoid loading
// a huge file into memory). The aggregate budget is enforced at submit time.
export const readFilesAsAttachments = async (
    files: File[],
): Promise<ReadFilesResult> => {
    const attachments: PendingAttachment[] = [];
    const errors: string[] = [];

    for (const file of files) {
        if (!isAllowedTextFile(file)) {
            errors.push(`${file.name}: unsupported file type (text files only).`);
            continue;
        }

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
    }

    return { attachments, errors };
}
