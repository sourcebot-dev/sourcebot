import { SBChatMessagePart } from "./types";

export const FILE_REFERENCE_PREFIX = '@file:';
export const FILE_REFERENCE_REGEX = new RegExp(
    // @file:{repoName::fileName:startLine-endLine}
    `${FILE_REFERENCE_PREFIX}\\{([^:}]+)::([^:}]+)(?::(\\d+)(?:-(\\d+))?)?\\}`, 
    'g'
);

export const ANSWER_TAG = '<!--answer-->';

export const toolNames = {
    searchCode: 'searchCode',
    readFiles: 'readFiles',
    findSymbolReferences: 'findSymbolReferences',
    findSymbolDefinitions: 'findSymbolDefinitions',
    searchRepos: 'searchRepos',
    listAllRepos: 'listAllRepos',
} as const;

// These part types are visible in the UI.
export const uiVisiblePartTypes: SBChatMessagePart['type'][] = [
    'reasoning',
    'text',
    'tool-searchCode',
    'tool-readFiles',
    'tool-findSymbolDefinitions',
    'tool-findSymbolReferences',
    'tool-searchRepos',
    'tool-listAllRepos',
] as const;