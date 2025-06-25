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
    "auth": {
      "type": "object",
      "description": "Authentication configuration for Gerrit",
      "properties": {
        "username": {
          "type": "string",
          "description": "Gerrit username for authentication",
          "examples": [
            "john.doe"
          ]
        },
        "password": {
          "description": "Gerrit HTTP password (not your account password). Generate this in Gerrit → Settings → HTTP Credentials → Generate Password.",
          "examples": [
            {
              "env": "GERRIT_HTTP_PASSWORD"
            },
            {
              "secret": "GERRIT_PASSWORD_SECRET"
            }
          ],
          "anyOf": [
            {
              "type": "string",
              "description": "Direct token value (not recommended for production)"
            },
            {
              "type": "object",
              "properties": {
                "secret": {
                  "type": "string",
                  "description": "The name of the secret that contains the token."
                }
              },
              "required": [
                "secret"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
                  "description": "The name of the environment variable that contains the token. Only supported in declarative connection configs."
                }
              },
              "required": [
                "env"
              ],
              "additionalProperties": false
            }
          ]
        }
      },
      "required": [
        "username",
        "password"
      ],
      "additionalProperties": false
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