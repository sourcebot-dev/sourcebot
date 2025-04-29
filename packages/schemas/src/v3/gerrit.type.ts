// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface GerritConnectionConfig {
  /**
   * Gerrit Configuration
   */
  type: "gerrit";
  /**
   * The URL of the Gerrit host.
   */
  url: string;
  /**
   * List of specific projects to sync. If not specified, all projects will be synced. Glob patterns are supported
   */
  projects?: string[];
  exclude?: {
    /**
     * List of specific projects to exclude from syncing.
     */
    projects?: string[];
    /**
     * Exclude read-only projects from syncing.
     */
    readOnly?: boolean;
    /**
     * Exclude hidden projects from syncing.
     */
    hidden?: boolean;
  };
}
