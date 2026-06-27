import { ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES } from '../constants';

export type AllowedImageMediaType = typeof ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES[number];

const isAllowedImageMediaType = (mediaType: string): mediaType is AllowedImageMediaType => {
    return (ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mediaType);
};

const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean => {
    if (buffer.length < offset + bytes.length) {
        return false;
    }
    for (let i = 0; i < bytes.length; i++) {
        if (buffer[offset + i] !== bytes[i]) {
            return false;
        }
    }
    return true;
};

/**
 * Determines an image's media type from its leading bytes (magic numbers),
 * ignoring any client-supplied MIME type or filename extension. Returns
 * `undefined` for anything that is not an allowlisted image format. This is the
 * authoritative content-type check for binary attachment uploads.
 */
export const detectImageMediaType = (buffer: Buffer): AllowedImageMediaType | undefined => {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return 'image/png';
    }
    // JPEG: FF D8 FF
    if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
        return 'image/jpeg';
    }
    // GIF: "GIF87a" or "GIF89a"
    if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
        return 'image/gif';
    }
    // WEBP: "RIFF" .... "WEBP"
    if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
        return 'image/webp';
    }
    return undefined;
};

export type AttachmentValidationResult =
    | { ok: true; mediaType: AllowedImageMediaType }
    | { ok: false; reason: string };

/**
 * Validates uploaded attachment bytes: confirms they are an allowlisted image
 * (by magic bytes) and that the bytes don't exceed `maxBytes`. The returned
 * `mediaType` is the magic-byte-derived type, which callers should persist
 * instead of any client-supplied value.
 */
export const validateImageAttachment = (
    buffer: Buffer,
    maxBytes: number,
): AttachmentValidationResult => {
    if (buffer.length === 0) {
        return { ok: false, reason: 'Empty file.' };
    }
    if (buffer.length > maxBytes) {
        return { ok: false, reason: `Image exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.` };
    }

    const mediaType = detectImageMediaType(buffer);
    if (!mediaType || !isAllowedImageMediaType(mediaType)) {
        return { ok: false, reason: 'Unsupported image type. Allowed: PNG, JPEG, WebP, GIF.' };
    }

    return { ok: true, mediaType };
};
