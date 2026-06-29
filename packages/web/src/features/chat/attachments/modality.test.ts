import { describe, expect, test } from 'vitest';
import {
    isAttachmentAccepted,
    isMediaTypeAccepted,
    isNativeMediaType,
    mediaTypeToDocumentType,
    mediaTypeToModality,
} from './modality';

describe('mediaTypeToModality', () => {
    test('maps single-medium media types to their modality', () => {
        expect(mediaTypeToModality('image/png')).toBe('image');
        expect(mediaTypeToModality('audio/mpeg')).toBe('audio');
        expect(mediaTypeToModality('video/mp4')).toBe('video');
    });

    test('does not treat PDF as a modality', () => {
        expect(mediaTypeToModality('application/pdf')).toBeUndefined();
    });

    test('returns undefined for unrecognized types', () => {
        expect(mediaTypeToModality('text/plain')).toBeUndefined();
        expect(mediaTypeToModality('application/octet-stream')).toBeUndefined();
    });
});

describe('mediaTypeToDocumentType', () => {
    test('maps application/pdf to pdf', () => {
        expect(mediaTypeToDocumentType('application/pdf')).toBe('pdf');
    });

    test('returns undefined for non-document types', () => {
        expect(mediaTypeToDocumentType('image/png')).toBeUndefined();
        expect(mediaTypeToDocumentType('text/plain')).toBeUndefined();
    });
});

describe('isNativeMediaType', () => {
    test('recognizes both modalities and document types', () => {
        expect(isNativeMediaType('image/png')).toBe(true);
        expect(isNativeMediaType('application/pdf')).toBe(true);
    });

    test('rejects plain text / unknown binaries', () => {
        expect(isNativeMediaType('text/plain')).toBe(false);
        expect(isNativeMediaType('application/octet-stream')).toBe(false);
    });
});

describe('isMediaTypeAccepted', () => {
    test('gates single-medium attachments on inputModalities only', () => {
        expect(isMediaTypeAccepted('image/png', ['text', 'image'])).toBe(true);
        expect(isMediaTypeAccepted('image/png', ['text'])).toBe(false);
        // PDF is not a modality, so it is never accepted via this gate.
        expect(isMediaTypeAccepted('application/pdf', ['text', 'image'])).toBe(false);
    });
});

describe('isAttachmentAccepted', () => {
    test('accepts an image only when the modality is supported', () => {
        expect(isAttachmentAccepted('image/png', { inputModalities: ['text', 'image'], supportedDocumentTypes: [] })).toBe(true);
        expect(isAttachmentAccepted('image/png', { inputModalities: ['text'], supportedDocumentTypes: ['pdf'] })).toBe(false);
    });

    test('accepts a PDF only when the document type is supported (independent of modalities)', () => {
        expect(isAttachmentAccepted('application/pdf', { inputModalities: ['text'], supportedDocumentTypes: ['pdf'] })).toBe(true);
        // Image support does not imply PDF support.
        expect(isAttachmentAccepted('application/pdf', { inputModalities: ['text', 'image'], supportedDocumentTypes: [] })).toBe(false);
    });

    test('rejects unrecognized media types regardless of capabilities', () => {
        expect(isAttachmentAccepted('application/octet-stream', { inputModalities: ['text', 'image'], supportedDocumentTypes: ['pdf'] })).toBe(false);
    });
});
