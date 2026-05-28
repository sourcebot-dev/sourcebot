export const FILE_REFERENCE_PREFIX = '@file:';
export const FILE_REFERENCE_REGEX = new RegExp(
    // @file:{repoName::fileName:startLine-endLine}
    `${FILE_REFERENCE_PREFIX}\\{([^:}]+)::([^:}]+)(?::(\\d+)(?:-(\\d+))?)?\\}`, 
    'g'
);

export const ANSWER_TAG = '<!--answer-->';

export const SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY = 'selectedSearchScopes';
export const SET_CHAT_STATE_SESSION_STORAGE_KEY = 'setChatState';

// Prompt sent when the user clicks "Visualize this" on an answer. The agent has
// the prior assistant answer in its message history, so it can produce a diagram
// from existing context without re-running every research step.
export const VISUALIZE_ANSWER_PROMPT = 'Visualize the previous answer as a diagram. Include a `mermaid` fenced code block using the most appropriate diagram type (sequenceDiagram, flowchart, graph, classDiagram, or erDiagram). Cite each node back to its source file using the @file:{...} format. Keep the diagram focused and readable.';
