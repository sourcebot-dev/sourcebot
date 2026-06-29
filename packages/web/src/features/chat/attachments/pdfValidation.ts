import 'server-only';

export type PdfValidationResult =
    | { ok: true; mediaType: 'application/pdf' }
    | { ok: false; reason: string };

// PDF files begin with the `%PDF-` signature. A small leading offset is
// tolerated because some producers emit a few junk/BOM bytes before the header,
// matching the leniency of real-world PDF readers.
const PDF_MAGIC = Buffer.from('%PDF-', 'latin1');
const MAX_MAGIC_OFFSET = 1024;

/**
 * Validates uploaded attachment bytes as a PDF by sniffing the `%PDF-` magic
 * bytes (never trusting the client-supplied MIME type or extension) and
 * enforcing the byte-size cap. Deliberately does NOT parse the document: page
 * count and render limits are enforced by the provider when the bytes are sent,
 * so we avoid pulling an untrusted-PDF parser into the upload path.
 */
export const validatePdfAttachment = (buffer: Buffer, maxBytes: number): PdfValidationResult => {
    if (buffer.length === 0) {
        return { ok: false, reason: 'Empty file.' };
    }
    if (buffer.length > maxBytes) {
        return { ok: false, reason: `PDF exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.` };
    }

    const header = buffer.subarray(0, MAX_MAGIC_OFFSET + PDF_MAGIC.length);
    if (header.indexOf(PDF_MAGIC) === -1) {
        return { ok: false, reason: 'Unsupported or corrupt PDF.' };
    }

    return { ok: true, mediaType: 'application/pdf' };
};

// Whether the buffer looks like a PDF (used by the upload route to dispatch to
// the PDF validator instead of the image validator).
export const looksLikePdf = (buffer: Buffer): boolean => {
    return buffer.subarray(0, MAX_MAGIC_OFFSET + PDF_MAGIC.length).indexOf(PDF_MAGIC) !== -1;
};
