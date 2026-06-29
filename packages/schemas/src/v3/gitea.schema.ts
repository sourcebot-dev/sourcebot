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
      "description": "The revisions (branches, tags) that should be included when indexing. The default branch (HEAD) is always indexed first. Sourcebot can index at most 64 total revisions per repository, including the default branch. Matching branches are considered before matching tags, and any revisions beyond the 64 revision limit are ignored.",
      "properties": {
        "branches": {
          "type": "array",
          "description": "List of branches to include when indexing. For a given repo, only the branches that exist on the repo's remote *and* match at least one of the provided `branches` will be indexed. The default branch (HEAD) is always indexed. Glob patterns are supported. Matching branches are considered before matching tags, and the combined default branch, branch, and tag revision list is capped at 64 total revisions.",
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
        "branchSort": {
          "type": "string",
          "description": "Sort order to use when listing candidate branches before matching branch glob patterns and applying the global 64 revision limit. Values map to Git `for-each-ref` sort keys. `committerdate` and `creatordate` sort newest-first, while `refname` sorts lexicographically by ref name. For branches, `creatordate` follows Git object creator-date semantics and is not a branch creation timestamp.",
          "enum": [
            "committerdate",
            "creatordate",
            "refname"
          ],
          "default": "committerdate"
        },
        "tags": {
          "type": "array",
          "description": "List of tags to include when indexing. For a given repo, only the tags that exist on the repo's remote *and* match at least one of the provided `tags` will be indexed. Glob patterns are supported. Matching tags are considered after matching branches, and the combined default branch, branch, and tag revision list is capped at 64 total revisions.",
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
        },
        "tagSort": {
          "type": "string",
          "description": "Sort order to use when listing candidate tags before matching tag glob patterns and applying the global 64 revision limit. Values map to Git `for-each-ref` sort keys. `committerdate` and `creatordate` sort newest-first, while `refname` sorts lexicographically by ref name.",
          "enum": [
            "committerdate",
            "creatordate",
            "refname"
          ],
          "default": "creatordate"
        }
      },
      "additionalProperties": false
    },
    "enforcePermissions": {
      "type": "boolean",
      "description": "Controls whether repository permissions are enforced for this connection. When `PERMISSION_SYNC_ENABLED` is false, this setting has no effect. Defaults to the value of `PERMISSION_SYNC_ENABLED`. See https://docs.sourcebot.dev/docs/features/permission-syncing"
    },
    "enforcePermissionsForPublicRepos": {
      "type": "boolean",
      "default": false,
      "description": "Controls whether repository permissions are enforced for public repositories in this connection. When true, public repositories are only visible to users with a linked account for this connection's code host. When false, public repositories are visible to all users. Has no effect when enforcePermissions is false. Defaults to false. See https://docs.sourcebot.dev/docs/features/permission-syncing"
    }
  },
  "required": [
    "type"
  ],
  "additionalProperties": false
} as const;
export { schema as giteaSchema };