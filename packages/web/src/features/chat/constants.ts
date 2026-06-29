export const FILE_REFERENCE_PREFIX = '@file:';
export const FILE_REFERENCE_REGEX = new RegExp(
    // @file:{repoName::fileName:startLine-endLine}
    `${FILE_REFERENCE_PREFIX}\\{([^:}]+)::([^:}]+)(?::(\\d+)(?:-(\\d+))?)?\\}`, 
    'g'
);

export const ANSWER_TAG = '<!--answer-->';

export const SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY = 'selectedSearchScopes';
export const SET_CHAT_STATE_SESSION_STORAGE_KEY = 'setChatState';
export const PENDING_CHAT_SUBMISSION_SESSION_STORAGE_KEY = 'pendingChatSubmission';
export const DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY = 'disabledMcpServerIds';
export const MCP_OAUTH_DRAFT_SESSION_STORAGE_KEY = 'mcpOAuthDraft';

// Single upper bound on the total attachment text submitted per turn (text is
// inlined and re-emitted every turn). ~256KB ≈ 65-85K tokens: enough for a few
// files or a large log while leaving room for retrieval, history, and output.
export const ATTACHMENT_MAX_TURN_TEXT_BYTES = 256 * 1024; // 256KB per turn

// Fallback client-side image size cap for early rejection before upload. The
// authoritative cap is SOURCEBOT_CHAT_ATTACHMENT_MAX_IMAGE_BYTES, fetched via
// `useAttachmentLimits`; this default is only used while that loads or if it
// fails (and matches the server default).
export const ATTACHMENT_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB per image

// Upper bound on an image attachment's pixel dimensions (width and height),
// enforced server-side at upload time. Guards against decompression bombs: a
// small-on-disk file that decodes to an enormous raster would otherwise be
// loaded into memory and shipped to the vision model.
export const ATTACHMENT_MAX_IMAGE_DIMENSION = 12000; // px per side

// Max image (blob) attachments per message. Enforced server-side in
// `commitMessageAttachments` (mirrored client-side for early feedback) to bound
// per-request memory/cost: each image is loaded and sent to the model.
export const ATTACHMENT_MAX_IMAGE_COUNT = 10;

// A plain-text paste at or above either of these thresholds is automatically
// converted into a text attachment instead of being inserted inline
export const ATTACHMENT_PASTE_AUTO_CONVERT_MIN_CHARS = 1500;
export const ATTACHMENT_PASTE_AUTO_CONVERT_MIN_LINES = 15;

// Allowlist for inline-text attachments. Files are accepted if their MIME type
// starts with `text/`, exactly matches an entry here, or their extension is in
// ATTACHMENT_ALLOWED_TEXT_EXTENSIONS. Many code files report an empty MIME type
// in the browser, hence the extension fallback.
export const ATTACHMENT_ALLOWED_TEXT_MIME_TYPES = [
    'application/json',
    'application/xml',
    'application/x-yaml',
    'application/yaml',
    'application/csv',
    'application/toml',
];

// Allowlist for binary image attachments. Validated server-side by magic
// bytes (never by client MIME/extension). `image/svg+xml` is intentionally
// excluded (XML/script surface). Used client-side only to build the file
// picker's `accept` filter and to gate the image-attach affordance.
export const ATTACHMENT_ALLOWED_IMAGE_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
] as const;

export const ATTACHMENT_ALLOWED_TEXT_EXTENSIONS = [
    'txt', 'md', 'markdown', 'log', 'csv', 'tsv', 'json', 'jsonl', 'yaml', 'yml',
    'toml', 'ini', 'cfg', 'conf', 'env', 'xml', 'html', 'css', 'scss',
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'rs', 'java',
    'kt', 'kts', 'c', 'h', 'cpp', 'cc', 'hpp', 'cs', 'php', 'swift', 'scala',
    'sh', 'bash', 'zsh', 'sql', 'graphql', 'gql', 'proto', 'dockerfile',
    'gitignore', 'tf', 'tfvars', 'lua', 'r', 'pl', 'dart', 'vue', 'svelte',
];
