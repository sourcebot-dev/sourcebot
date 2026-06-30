import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { looksLikePdf, validatePdfAttachment } = await import('./pdfValidation');

const MAX_BYTES = 32 * 1024 * 1024;

const pdfBuffer = (body = '1.7\n%fake') => Buffer.from(`%PDF-${body}`, 'latin1');

describe('looksLikePdf', () => {
    test('recognizes the %PDF- magic at the start', () => {
        expect(looksLikePdf(pdfBuffer())).toBe(true);
    });

    test('tolerates a small leading offset before the magic', () => {
        const buffer = Buffer.concat([Buffer.from('\uFEFF junk '.repeat(3), 'latin1'), pdfBuffer()]);
        expect(looksLikePdf(buffer)).toBe(true);
    });

    test('rejects non-PDF bytes', () => {
        expect(looksLikePdf(Buffer.from('PK\u0003\u0004 zip bytes', 'latin1'))).toBe(false);
        expect(looksLikePdf(Buffer.from('plain text', 'latin1'))).toBe(false);
    });
});

describe('validatePdfAttachment', () => {
    test('accepts a well-formed PDF and reports the canonical media type', () => {
        const result = validatePdfAttachment(pdfBuffer(), MAX_BYTES);
        expect(result).toEqual({ ok: true, mediaType: 'application/pdf' });
    });

    test('rejects empty input', () => {
        const result = validatePdfAttachment(Buffer.alloc(0), MAX_BYTES);
        expect(result.ok).toBe(false);
    });

    test('rejects bytes over the size cap', () => {
        const result = validatePdfAttachment(pdfBuffer(), 4);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toContain('limit');
        }
    });

    test('rejects bytes without the PDF magic', () => {
        const result = validatePdfAttachment(Buffer.from('not a pdf at all', 'latin1'), MAX_BYTES);
        expect(result.ok).toBe(false);
    });
});
