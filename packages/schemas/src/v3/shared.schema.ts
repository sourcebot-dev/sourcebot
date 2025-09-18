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
            "secret": {
              "type": "string",
              "minLength": 1,
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
              "minLength": 1,
              "description": "The name of the environment variable that contains the token. Only supported in declarative connection configs."
            }
          },
          "required": [
            "env"
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
                    "secret": {
                      "type": "string",
                      "minLength": 1,
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
                      "minLength": 1,
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
                    "secret": {
                      "type": "string",
                      "minLength": 1,
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
                      "minLength": 1,
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
          ]
        }
      },
      "additionalProperties": false
    }
  }
} as const;
export { schema as sharedSchema };