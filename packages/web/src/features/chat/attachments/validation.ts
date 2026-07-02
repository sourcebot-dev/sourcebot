import 'server-only';

import sharp from 'sharp';
import { ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES, ATTACHMENT_MAX_IMAGE_DIMENSION } from '../constants';

export type AllowedImageMediaType = typeof ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES[number];

const isAllowedImageMediaType = (mediaType: string): mediaType is AllowedImageMediaType => {
    return (ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mediaType);
};

// sharp/libvips reports the decoded format by name; map the formats we allow to
// their canonical media type. Anything not in this map (svg, tiff, heif, ...)
// is rejected, so the allowlist is enforced by the absence of an entry here as
// well as by `isAllowedImageMediaType`.
const SHARP_FORMAT_TO_MEDIA_TYPE: Record<string, AllowedImageMediaType> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
};

export type AttachmentValidationResult =
    | { ok: true; mediaType: AllowedImageMediaType }
    | { ok: false; reason: string };

/**
 * Validates uploaded attachment bytes by decoding the image header with sharp
 * (libvips), never trusting the client-supplied MIME type or extension. This
 * authoritatively determines the format AND the pixel dimensions, letting us
 * reject:
 *   - non-images / corrupt data (sharp throws),
 *   - disallowed formats (no entry in SHARP_FORMAT_TO_MEDIA_TYPE),
 *   - over-`maxBytes` files, and
 *   - decompression bombs (dimensions over ATTACHMENT_MAX_IMAGE_DIMENSION).
 * The returned `mediaType` is the decoded type, which callers persist instead of
 * any client-supplied value.
 */
export const validateImageAttachment = async (
    buffer: Buffer,
    maxBytes: number,
): Promise<AttachmentValidationResult> => {
    if (buffer.length === 0) {
        return { ok: false, reason: 'Empty file.' };
    }
    if (buffer.length > maxBytes) {
        return { ok: false, reason: `Image exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.` };
    }

    let metadata: sharp.Metadata;
    try {
        // `failOn: 'error'` makes sharp reject truncated/corrupt inputs instead
        // of best-effort decoding them.
        metadata = await sharp(buffer, { failOn: 'error' }).metadata();
    } catch {
        return { ok: false, reason: 'Unsupported or corrupt image. Allowed: PNG, JPEG, WebP, GIF.' };
    }

    const mediaType = metadata.format ? SHARP_FORMAT_TO_MEDIA_TYPE[metadata.format] : undefined;
    if (!mediaType || !isAllowedImageMediaType(mediaType)) {
        return { ok: false, reason: 'Unsupported image type. Allowed: PNG, JPEG, WebP, GIF.' };
    }

    const { width, height } = metadata;
    if (!width || !height) {
        return { ok: false, reason: 'Could not determine image dimensions.' };
    }
    if (width > ATTACHMENT_MAX_IMAGE_DIMENSION || height > ATTACHMENT_MAX_IMAGE_DIMENSION) {
        return {
            ok: false,
            reason: `Image dimensions exceed the ${ATTACHMENT_MAX_IMAGE_DIMENSION}px limit.`,
        };
    }

    return { ok: true, mediaType };
};
