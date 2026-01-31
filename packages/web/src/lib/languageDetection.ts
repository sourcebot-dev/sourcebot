import * as linguistLanguages from 'linguist-languages';
import path from 'path';

const extensionToLanguage = new Map<string, string>();

for (const [languageName, languageData] of Object.entries(linguistLanguages)) {
    if ('extensions' in languageData && languageData.extensions) {
        for (const ext of languageData.extensions) {
            if (!extensionToLanguage.has(ext)) {
                extensionToLanguage.set(ext, languageName);
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
    if (ext && extensionToLanguage.has(ext)) {
        return extensionToLanguage.get(ext)!;
    }

    return '';
};
