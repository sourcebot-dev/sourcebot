import { DocumentType, InputModality } from "../types";

// Single-medium modalities an attachment blob can occupy (text is excluded: it
// travels inline in the message, not as a native attachment part).
export type AttachmentModality = Exclude<InputModality, 'text'>;

/**
 * Maps a stored attachment's media type to the model input modality it occupies,
 * or `undefined` when it isn't a recognized single-medium attachment. The single
 * source of truth for "what single-medium modality is this"; extend it to add
 * audio/video support. Compound document formats (e.g. PDF) are NOT modalities;
 * see `mediaTypeToDocumentType`.
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
 * Maps a stored attachment's media type to the compound document type it
 * represents, or `undefined` when it isn't a recognized document. Distinct from
 * `mediaTypeToModality`: document types (e.g. PDF) are gated on the model's
 * `supportedDocumentTypes`, not its `inputModalities`, because providers
 * decompose them server-side rather than encoding them as a raw channel.
 */
export const mediaTypeToDocumentType = (mediaType: string): DocumentType | undefined => {
    if (mediaType === 'application/pdf') {
        return 'pdf';
    }
    return undefined;
};

// The capabilities a model exposes for native attachment ingestion: the raw
// channels it encodes plus the compound document formats it decomposes.
export type AttachmentCapabilities = {
    inputModalities: InputModality[];
    supportedDocumentTypes: DocumentType[];
};

/**
 * Whether a model that accepts `acceptedModalities` can natively ingest an
 * attachment of `mediaType` as a single-medium modality.
 */
export const isMediaTypeAccepted = (mediaType: string, acceptedModalities: InputModality[]): boolean => {
    const modality = mediaTypeToModality(mediaType);
    return modality !== undefined && acceptedModalities.includes(modality);
};

// Whether `mediaType` maps to either a known single-medium modality or a known
// compound document type (regardless of model support). Used to recognize which
// blob attachments are "native media" the agent may send to the model.
export const isNativeMediaType = (mediaType: string): boolean => {
    return mediaTypeToModality(mediaType) !== undefined || mediaTypeToDocumentType(mediaType) !== undefined;
};

/**
 * Whether a model with `caps` can natively ingest an attachment of `mediaType`,
 * across BOTH capability axes: a single-medium modality (image/audio/video) or a
 * compound document type (pdf). The single gate the upload, degrade-accounting,
 * and agent content builder all share.
 */
export const isAttachmentAccepted = (mediaType: string, caps: AttachmentCapabilities): boolean => {
    const modality = mediaTypeToModality(mediaType);
    if (modality !== undefined) {
        return caps.inputModalities.includes(modality);
    }
    const documentType = mediaTypeToDocumentType(mediaType);
    if (documentType !== undefined) {
        return caps.supportedDocumentTypes.includes(documentType);
    }
    return false;
};
