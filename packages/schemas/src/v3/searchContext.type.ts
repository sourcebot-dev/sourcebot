// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

/**
 * Search context
 */
export interface SearchContext {
  /**
   * List of repositories to include in the search context. Expected to be formatted as a URL without any leading http(s):// prefix (e.g., 'github.com/sourcebot-dev/sourcebot'). Glob patterns are supported.
   */
  include?: string[];
  /**
   * List of connections to include in the search context.
   */
  includeConnections?: string[];
  /**
   * List of repositories to exclude from the search context. Expected to be formatted as a URL without any leading http(s):// prefix (e.g., 'github.com/sourcebot-dev/sourcebot'). Glob patterns are supported.
   */
  exclude?: string[];
  /**
   * List of connections to exclude from the search context.
   */
  excludeConnections?: string[];
  /**
   * Optional description of the search context that surfaces in the UI.
   */
  description?: string;
}
