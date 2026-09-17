// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "definitions": {
    "Token": {
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
    },
    "GitRevisions": {
      "type": "object",
      "description": "The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed. A maximum of 64 revisions can be indexed, with any additional revisions being ignored.",
      "properties": {
        "branches": {
          "type": "array",
          "description": "List of branches to include when indexing. For a given repo, only the branches that exist on the repo's remote *and* match at least one of the provided `branches` will be indexed. The default branch (HEAD) is always indexed. Glob patterns are supported. A maximum of 64 branches can be indexed, with any additional branches being ignored.",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "main",
              "release/*"
            ],
            [
              "**"
            ]
          ],
          "default": []
        },
        "tags": {
          "type": "array",
          "description": "List of tags to include when indexing. For a given repo, only the tags that exist on the repo's remote *and* match at least one of the provided `tags` will be indexed. Glob patterns are supported. A maximum of 64 tags can be indexed, with any additional tags being ignored.",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "latest",
              "v2.*.*"
            ],
            [
              "**"
            ]
          ],
          "default": []
        }
      },
      "additionalProperties": false
    },
    "LanguageModelHeaders": {
      "type": "object",
      "description": "Optional headers to use with the model.",
      "patternProperties": {
        "^[!#$%&'*+\\-.^_`|~0-9A-Za-z]+$": {
          "anyOf": [
            {
              "type": "string"
            },
            {
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
          ]
        }
      },
      "additionalProperties": false
    },
    "LanguageModelQueryParams": {
      "type": "object",
      "description": "Optional query parameters to include in the request url.",
      "patternProperties": {
        "^[!#$%&'*+\\-.^_`|~0-9A-Za-z]+$": {
          "anyOf": [
            {
              "type": "string"
            },
            {
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
          ]
        }
      },
      "additionalProperties": false
    },
    "LanguageModelRetry": {
      "type": "object",
      "description": "Optional retry policy for inference requests made with this model. When unset, defaults apply (up to 3 attempts with exponential backoff starting at 500ms).",
      "properties": {
        "maxRetries": {
          "type": "integer",
          "description": "Maximum number of retry attempts for a failed inference request. Only transient failures (network errors, 408/429/5xx responses) are retried. Set to 0 to disable retries. Defaults to 3.",
          "minimum": 0,
          "maximum": 10,
          "default": 3
        },
        "initialBackoffMs": {
          "type": "integer",
          "description": "Delay in milliseconds before the first retry. Doubles after each attempt, up to maxBackoffMs. Defaults to 500.",
          "minimum": 0,
          "maximum": 60000,
          "default": 500
        },
        "maxBackoffMs": {
          "type": "integer",
          "description": "Maximum delay in milliseconds between retries. Defaults to 8000.",
          "minimum": 0,
          "maximum": 120000,
          "default": 8000
        }
      },
      "additionalProperties": false
    },
    "LanguageModelFallbackReference": {
      "type": "object",
      "description": "Reference to another configured language model to fall back to when inference requests with this model fail.",
      "properties": {
        "provider": {
          "type": "string",
          "description": "The provider of the fallback language model. Must match the provider of another entry in `models`.",
          "enum": [
            "amazon-bedrock",
            "anthropic",
            "azure",
            "deepseek",
            "google-generative-ai",
            "google-vertex-anthropic",
            "google-vertex",
            "mistral",
            "openai",
            "openai-compatible",
            "openrouter",
            "xai"
          ]
        },
        "model": {
          "type": "string",
          "description": "The name of the fallback language model. Must match the `model` of another entry in `models` with the same provider."
        },
        "displayName": {
          "type": "string",
          "description": "Optional display name. When set, the fallback matches the configured model with the same provider, model and display name."
        }
      },
      "required": [
        "provider",
        "model"
      ],
      "additionalProperties": false
    }
  }
} as const;
export { schema as sharedSchema };