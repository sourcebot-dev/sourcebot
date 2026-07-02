import { InputModality } from "../types";

// Single-medium modalities an attachment blob can occupy (text is excluded: it
// travels inline in the message, not as a native attachment part).
export type AttachmentModality = Exclude<InputModality, 'text'>;

/**
 * Maps a stored attachment's media type to the model input modality it occupies,
 * or `undefined` when it isn't a recognized single-medium attachment. The single
 * source of truth for "what kind of attachment is this"; extend it to add
 * PDF/audio/video support.
 */
export const mediaTypeToModality = (mediaType: string): AttachmentModality | undefined => {
    if (mediaType.startsWith('image/')) {
        return 'image';
    }
    if (mediaType.startsWith('audio/')) {
        return 'audio';
    }
    if (mediaType.startsWith('video/')) {
        return 'video';
    }
    return undefined;
};

/**
 * Whether a model that accepts `acceptedModalities` can natively ingest an
 * attachment of `mediaType`.
 */
export const isMediaTypeAccepted = (mediaType: string, acceptedModalities: InputModality[]): boolean => {
    const modality = mediaTypeToModality(mediaType);
    return modality !== undefined && acceptedModalities.includes(modality);
};
