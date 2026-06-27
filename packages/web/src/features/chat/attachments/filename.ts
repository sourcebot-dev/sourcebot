// Normalizes an untrusted filename: keeps only the basename, drops control
// characters (which could break the prompt's `<attachment filename="...">` tag
// or the UI), and collapses whitespace. Lives in a non-client module so both
// the client picker and the server upload route can share one implementation.
export const sanitizeFilename = (name: string): string => {
    const basename = name.split(/[\\/]/).pop() ?? name;
    return Array.from(basename)
        .filter((char) => {
            const code = char.charCodeAt(0);
            return code >= 32 && code !== 127;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim() || 'attachment';
};
