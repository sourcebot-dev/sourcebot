// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "type": "object",
  "description": "Environment variable overrides.",
  "name": "EnvironmentOverrides",
  "not": {
    "$comment": "List of environment variables that are not allowed to be overridden.",
    "anyOf": [
      {
        "required": [
          "CONFIG_PATH"
        ]
      }
    ]
  },
  "patternProperties": {
    "^[a-zA-Z0-9_-]+$": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "type": {
              "const": "token"
            },
            "value": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "env": {
                      "type": "string",
                      "description": "The name of the environment variable that contains the token."
                    }
                  },
                  "required": [
                    "env"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "googleCloudSecret": {
                      "type": "string",
                      "description": "The resource name of a Google Cloud secret. Must be in the format `projects/<project-id>/secrets/<secret-name>/versions/<version-id>`. See https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets"
                    }
                  },
                  "required": [
                    "googleCloudSecret"
                  ],
                  "additionalProperties": false
                }
              ]
            }
          },
          "required": [
            "type",
            "value"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": {
              "const": "string"
            },
            "value": {
              "type": "string"
            }
          },
          "required": [
            "type",
            "value"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": {
              "const": "number"
            },
            "value": {
              "type": "number"
            }
          },
          "required": [
            "type",
            "value"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": {
              "const": "boolean"
            },
            "value": {
              "type": "boolean"
            }
          },
          "required": [
            "type",
            "value"
          ],
          "additionalProperties": false
        }
      ]
    }
  }
} as const;
export { schema as environmentOverridesSchema };