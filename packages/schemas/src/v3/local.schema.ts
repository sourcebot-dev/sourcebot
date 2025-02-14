// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "GerritConnectionConfig",
  "properties": {
    "type": {
      "const": "local",
      "description": "Local Configuration"
    },
    "path": {
      "type": "string",
      "description": "Path to the local directory to sync with. Relative paths are relative to the configuration file's directory.",
      "pattern": ".+"
    },
    "watch": {
      "type": "boolean",
      "default": true,
      "description": "Enables a file watcher that will automatically re-sync when changes are made within `path` (recursively). Defaults to true."
    },
    "exclude": {
      "type": "object",
      "properties": {
        "paths": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": ".+"
          },
          "description": "List of paths relative to the provided `path` to exclude from the index. .git, .hg, and .svn are always exluded.",
          "default": [],
          "examples": [
            [
              "node_modules",
              "bin",
              "dist",
              "build",
              "out"
            ]
          ]
        }
      },
      "additionalProperties": false
    }
  },
  "required": [
    "type",
    "path"
  ],
  "additionalProperties": false
} as const;
export { schema as localSchema };