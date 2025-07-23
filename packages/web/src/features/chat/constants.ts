
export const FILE_REFERENCE_PREFIX = '@file:';
export const FILE_REFERENCE_REGEX = new RegExp(`${FILE_REFERENCE_PREFIX}\\{([^:}]+)(?::(\\d+)(?:-(\\d+))?)?\\}`, 'g');

export const ANSWER_TAG = '<!--answer-->';

export const toolNames = {
    searchCode: 'searchCode',
    readFiles: 'readFiles',
    findSymbolReferences: 'findSymbolReferences',
    findSymbolDefinitions: 'findSymbolDefinitions',
} as const;