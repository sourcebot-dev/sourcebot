export const FILE_REFERENCE_PREFIX = '@file:';
export const FILE_REFERENCE_REGEX = new RegExp(
    // @file:{repoName::fileName:startLine-endLine}
    `${FILE_REFERENCE_PREFIX}\\{([^:}]+)::([^:}]+)(?::(\\d+)(?:-(\\d+))?)?\\}`, 
    'g'
);

export const ANSWER_TAG = '<!--answer-->';

export const SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY = 'selectedSearchScopes';
export const SET_CHAT_STATE_SESSION_STORAGE_KEY = 'setChatState';
