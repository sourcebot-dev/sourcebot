// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "GerritConnectionConfig",
  "properties": {
    "type": {
      "const": "gerrit",
      "description": "Gerrit Configuration"
    },
    "url": {
      "type": "string",
      "format": "url",
      "description": "The URL of the Gerrit host.",
      "examples": [
        "https://gerrit.example.com"
      ],
      "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$"
    },
    "projects": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "List of specific projects to sync. If not specified, all projects will be synced. Glob patterns are supported",
      "examples": [
        [
          "project1/repo1",
          "project2/**"
        ]
      ]
    },
    "exclude": {
      "type": "object",
      "properties": {
        "projects": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "project1/repo1",
              "project2/**"
            ]
          ],
          "description": "List of specific projects to exclude from syncing."
        },
        "readOnly": {
          "type": "boolean",
          "default": false,
          "description": "Exclude read-only projects from syncing."
        },
        "hidden": {
          "type": "boolean",
          "default": false,
          "description": "Exclude hidden projects from syncing."
        }
      },
      "additionalProperties": false
    }
  },
  "required": [
    "type",
    "url"
  ],
  "additionalProperties": false
} as const;
export { schema as gerritSchema };