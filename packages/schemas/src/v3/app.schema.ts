// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AppConfig",
  "definitions": {
    "GitHubAppConfig": {
      "type": "object",
      "properties": {
        "type": {
          "const": "github",
          "description": "GitHub App Configuration"
        },
        "deploymentHostname": {
          "type": "string",
          "format": "hostname",
          "default": "github.com",
          "description": "The hostname of the GitHub App deployment.",
          "examples": [
            "github.com",
            "github.example.com"
          ]
        },
        "id": {
          "type": "string",
          "description": "The ID of the GitHub App."
        },
        "privateKey": {
          "description": "The private key of the GitHub App.",
          "anyOf": [
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
        "type",
        "id",
        "privateKey"
      ],
      "additionalProperties": false
    }
  },
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "type": {
          "const": "github",
          "description": "GitHub App Configuration"
        },
        "deploymentHostname": {
          "type": "string",
          "format": "hostname",
          "default": "github.com",
          "description": "The hostname of the GitHub App deployment.",
          "examples": [
            "github.com",
            "github.example.com"
          ]
        },
        "id": {
          "type": "string",
          "description": "The ID of the GitHub App."
        },
        "privateKey": {
          "description": "The private key of the GitHub App.",
          "anyOf": [
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
        "type",
        "id",
        "privateKey"
      ],
      "additionalProperties": false
    }
  ]
} as const;
export { schema as appSchema };