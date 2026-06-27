import { ATTACHMENT_MAX_FILENAME_LENGTH } from '../constants';

// Normalizes an untrusted filename: keeps only the basename, drops control
// characters (which could break the prompt's `<attachment filename="...">` tag
// or the UI), collapses whitespace, and caps the length while preserving the
// extension. Long/abusive names are truncated rather than rejected. Lives in a
// non-client module so both the client picker and the server upload route can
// share one implementation.
export const sanitizeFilename = (name: string): string => {
    const basename = name.split(/[\\/]/).pop() ?? name;
    const cleaned = Array.from(basename)
        .filter((char) => {
            const code = char.charCodeAt(0);
            return code >= 32 && code !== 127;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim() || 'attachment';

    if (cleaned.length <= ATTACHMENT_MAX_FILENAME_LENGTH) {
        return cleaned;
    }

    const dotIndex = cleaned.lastIndexOf('.');
    const extension = dotIndex > 0 ? cleaned.slice(dotIndex) : '';
    const stem = dotIndex > 0 ? cleaned.slice(0, dotIndex) : cleaned;
    const keep = Math.max(1, ATTACHMENT_MAX_FILENAME_LENGTH - extension.length - 1);
    return `${stem.slice(0, keep)}…${extension}`;
};
