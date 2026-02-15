import * as linguistLanguages from 'linguist-languages';
import path from 'path';

// Override map for extensions that are ambiguous in linguist-languages.
// These are extensions where linguist maps to multiple languages, but one
// is overwhelmingly more common in practice.
const ambiguousExtensionOverrides: Record<string, string> = {
    '.cs': 'C#',        // Not Smalltalk
    '.fs': 'F#',        // Not Forth, GLSL, or Filterscript
    '.html': 'HTML',    // Not Ecmarkup
    '.json': 'JSON',    // Not OASv2-json, OASv3-json
    '.md': 'Markdown',  // Not GCC Machine Description
    '.rs': 'Rust',      // Not RenderScript (deprecated)
    '.tsx': 'TSX',      // Not XML
    '.ts': 'TypeScript', // Not XML
    '.txt': 'Text',     // Not Adblock Filter List, Vim Help File
    '.yaml': 'YAML',    // Not MiniYAML, OASv2-yaml, OASv3-yaml
    '.yml': 'YAML',
};

const extensionToLanguage = new Map<string, string>();

for (const [languageName, languageData] of Object.entries(linguistLanguages)) {
    if ('extensions' in languageData && languageData.extensions) {
        for (const ext of languageData.extensions) {
            const normalizedExt = ext.toLowerCase();
            if (!extensionToLanguage.has(normalizedExt)) {
                extensionToLanguage.set(normalizedExt, languageName);
            }
        }
    }
    if ('filenames' in languageData && languageData.filenames) {
        for (const filename of languageData.filenames) {
            if (!extensionToLanguage.has(filename)) {
                extensionToLanguage.set(filename, languageName);
            }
        }
    }
}

export const detectLanguageFromFilename = (filename: string): string => {
    const basename = path.basename(filename);

    // Check for exact filename match (e.g., Makefile, Dockerfile)
    if (extensionToLanguage.has(basename)) {
        return extensionToLanguage.get(basename)!;
    }

    // Check for extension match
    const ext = path.extname(filename).toLowerCase();

    // Check override map first for ambiguous extensions
    if (ext && ext in ambiguousExtensionOverrides) {
        return ambiguousExtensionOverrides[ext];
    }

    if (ext && extensionToLanguage.has(ext)) {
        return extensionToLanguage.get(ext)!;
    }

    return '';
};
