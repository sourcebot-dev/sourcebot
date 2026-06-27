'use client';

// Client-only cache mapping an attachment id to its local object URL, so a
// just-sent image renders instantly instead of 404ing on the serving route
// until the attachment is committed. Entries live for the page's lifetime.
const previewUrlByAttachmentId = new Map<string, string>();

export const setAttachmentPreviewUrl = (attachmentId: string, objectUrl: string): void => {
    previewUrlByAttachmentId.set(attachmentId, objectUrl);
}

export const getAttachmentPreviewUrl = (attachmentId: string): string | undefined => {
    return previewUrlByAttachmentId.get(attachmentId);
}
