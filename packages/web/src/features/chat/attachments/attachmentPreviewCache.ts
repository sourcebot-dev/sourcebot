'use client';

// Client-only cache mapping an attachment id to its local object URL, so a
// just-sent image renders instantly instead of 404ing before it's committed.
// Entries are released once the served image loads (see releaseAttachmentPreviewUrl).
const previewUrlByAttachmentId = new Map<string, string>();

export const setAttachmentPreviewUrl = (attachmentId: string, objectUrl: string): void => {
    previewUrlByAttachmentId.set(attachmentId, objectUrl);
}

export const getAttachmentPreviewUrl = (attachmentId: string): string | undefined => {
    return previewUrlByAttachmentId.get(attachmentId);
}

// Revokes and drops the cached preview (no-op if absent). Call once the served
// image has loaded so the object URL and its bytes can be reclaimed.
export const releaseAttachmentPreviewUrl = (attachmentId: string): void => {
    const objectUrl = previewUrlByAttachmentId.get(attachmentId);
    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        previewUrlByAttachmentId.delete(attachmentId);
    }
}
