// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "GiteaConnectionConfig",
  "properties": {
    "type": {
      "const": "gitea",
      "description": "Gitea Configuration"
    },
    "token": {
      "description": "A Personal Access Token (PAT).",
      "examples": [
        "secret-token",
        {
          "env": "ENV_VAR_CONTAINING_TOKEN"
        }
      ],
      "anyOf": [
        {
          "type": "string"
        },
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
            "secret": {
              "type": "string",
              "description": "The name of the secret that contains the token."
            }
          },
          "required": [
            "secret"
          ],
          "additionalProperties": false
        }
      ]
    },
    "url": {
      "type": "string",
      "format": "url",
      "default": "https://gitea.com",
      "description": "The URL of the Gitea host. Defaults to https://gitea.com",
      "examples": [
        "https://gitea.com",
        "https://gitea.example.com"
      ],
      "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$"
    },
    "orgs": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "examples": [
        [
          "my-org-name"
        ]
      ],
      "description": "List of organizations to sync with. All repositories in the organization visible to the provided `token` (if any) will be synced, unless explicitly defined in the `exclude` property. If a `token` is provided, it must have the read:organization scope."
    },
    "repos": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[\\w.-]+\\/[\\w.-]+$"
      },
      "description": "List of individual repositories to sync with. Expected to be formatted as '{orgName}/{repoName}' or '{userName}/{repoName}'."
    },
    "users": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "examples": [
        [
          "username-1",
          "username-2"
        ]
      ],
      "description": "List of users to sync with. All repositories that the user owns will be synced, unless explicitly defined in the `exclude` property. If a `token` is provided, it must have the read:user scope."
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
export { schema as giteaSchema };