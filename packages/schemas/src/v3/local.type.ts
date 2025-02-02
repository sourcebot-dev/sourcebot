// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

export interface GerritConnectionConfig {
  /**
   * Local Configuration
   */
  type: "local";
  /**
   * Path to the local directory to sync with. Relative paths are relative to the configuration file's directory.
   */
  path: string;
  /**
   * Enables a file watcher that will automatically re-sync when changes are made within `path` (recursively). Defaults to true.
   */
  watch?: boolean;
  exclude?: {
    /**
     * List of paths relative to the provided `path` to exclude from the index. .git, .hg, and .svn are always exluded.
     */
    paths?: string[];
  };
}
