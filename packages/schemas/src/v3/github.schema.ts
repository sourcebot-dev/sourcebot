// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "GithubConnectionConfig",
  "properties": {
    "type": {
      "const": "github",
      "description": "GitHub Configuration"
    },
    "token": {
      "description": "A Personal Access Token (PAT).",
      "examples": [
        {
          "secret": "SECRET_KEY"
        }
      ],
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
    "url": {
      "type": "string",
      "format": "url",
      "default": "https://github.com",
      "description": "The URL of the GitHub host. Defaults to https://github.com",
      "examples": [
        "https://github.com",
        "https://github.example.com"
      ],
      "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$"
    },
    "users": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[\\w.-]+$"
      },
      "examples": [
        [
          "torvalds",
          "DHH"
        ]
      ],
      "description": "List of users to sync with. All repositories that the user owns will be synced, unless explicitly defined in the `exclude` property."
    },
    "orgs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[\\w.-]+$"
      },
      "default": [],
      "examples": [
        [
          "my-org-name"
        ],
        [
          "sourcebot-dev",
          "commaai"
        ]
      ],
      "description": "List of organizations to sync with. All repositories in the organization visible to the provided `token` (if any) will be synced, unless explicitly defined in the `exclude` property."
    },
    "repos": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[\\w.-]+\\/[\\w.-]+$"
      },
      "description": "List of individual repositories to sync with. Expected to be formatted as '{orgName}/{repoName}' or '{userName}/{repoName}'."
    },
    "topics": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "minItems": 1,
      "description": "List of repository topics to include when syncing. Only repositories that match at least one of the provided `topics` will be synced. If not specified, all repositories will be synced, unless explicitly defined in the `exclude` property. Glob patterns are supported.",
      "examples": [
        [
          "docs",
          "core"
        ]
      ]
    },
    "exclude": {
      "type": "object",
      "properties": {
        "forks": {
          "type": "boolean",
          "default": false,
          "description": "Exclude forked repositories from syncing."
        },
        "archived": {
          "type": "boolean",
          "default": false,
          "description": "Exclude archived repositories from syncing."
        },
        "repos": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "default": [],
          "description": "List of individual repositories to exclude from syncing. Glob patterns are supported."
        },
        "topics": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "List of repository topics to exclude when syncing. Repositories that match one of the provided `topics` will be excluded from syncing. Glob patterns are supported.",
          "examples": [
            [
              "tests",
              "ci"
            ]
          ]
        },
        "size": {
          "type": "object",
          "description": "Exclude repositories based on their disk usage. Note: the disk usage is calculated by GitHub and may not reflect the actual disk usage when cloned.",
          "properties": {
            "min": {
              "type": "integer",
              "description": "Minimum repository size (in bytes) to sync (inclusive). Repositories less than this size will be excluded from syncing."
            },
            "max": {
              "type": "integer",
              "description": "Maximum repository size (in bytes) to sync (inclusive). Repositories greater than this size will be excluded from syncing."
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "revisions": {
      "type": "object",
      "description": "The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed.",
      "properties": {
        "branches": {
          "type": "array",
          "description": "List of branches to include when indexing. For a given repo, only the branches that exist on the repo's remote *and* match at least one of the provided `branches` will be indexed. The default branch (HEAD) is always indexed. Glob patterns are supported.",
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
          "description": "List of tags to include when indexing. For a given repo, only the tags that exist on the repo's remote *and* match at least one of the provided `tags` will be indexed. Glob patterns are supported.",
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
    }
  },
  "required": [
    "type"
  ],
  "additionalProperties": false
} as const;
export { schema as githubSchema };