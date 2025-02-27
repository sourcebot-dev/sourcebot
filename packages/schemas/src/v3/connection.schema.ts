// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ConnectionConfig",
  "oneOf": [
    {
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
          "default": [],
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
          "default": [],
          "description": "List of individual repositories to sync with. Expected to be formatted as '{orgName}/{repoName}' or '{userName}/{repoName}'."
        },
        "topics": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "minItems": 1,
          "default": [],
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
              "default": [],
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
        }
      },
      "required": [
        "type"
      ],
      "additionalProperties": false
    },
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "title": "GitlabConnectionConfig",
      "properties": {
        "type": {
          "const": "gitlab",
          "description": "GitLab Configuration"
        },
        "token": {
          "$ref": "#/oneOf/0/properties/token",
          "description": "An authentication token.",
          "examples": [
            {
              "secret": "SECRET_KEY"
            }
          ]
        },
        "url": {
          "type": "string",
          "format": "url",
          "default": "https://gitlab.com",
          "description": "The URL of the GitLab host. Defaults to https://gitlab.com",
          "examples": [
            "https://gitlab.com",
            "https://gitlab.example.com"
          ],
          "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$"
        },
        "all": {
          "type": "boolean",
          "default": false,
          "description": "Sync all projects visible to the provided `token` (if any) in the GitLab instance. This option is ignored if `url` is either unset or set to https://gitlab.com ."
        },
        "users": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "List of users to sync with. All projects owned by the user and visible to the provided `token` (if any) will be synced, unless explicitly defined in the `exclude` property."
        },
        "groups": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "my-group"
            ],
            [
              "my-group/sub-group-a",
              "my-group/sub-group-b"
            ]
          ],
          "description": "List of groups to sync with. All projects in the group (and recursive subgroups) visible to the provided `token` (if any) will be synced, unless explicitly defined in the `exclude` property. Subgroups can be specified by providing the path to the subgroup (e.g. `my-group/sub-group-a`)."
        },
        "projects": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "my-group/my-project"
            ],
            [
              "my-group/my-sub-group/my-project"
            ]
          ],
          "description": "List of individual projects to sync with. The project's namespace must be specified. See: https://docs.gitlab.com/ee/user/namespace/"
        },
        "topics": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "minItems": 1,
          "description": "List of project topics to include when syncing. Only projects that match at least one of the provided `topics` will be synced. If not specified, all projects will be synced, unless explicitly defined in the `exclude` property. Glob patterns are supported.",
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
              "description": "Exclude forked projects from syncing."
            },
            "archived": {
              "type": "boolean",
              "default": false,
              "description": "Exclude archived projects from syncing."
            },
            "projects": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "examples": [
                [
                  "my-group/my-project"
                ]
              ],
              "description": "List of projects to exclude from syncing. Glob patterns are supported. The project's namespace must be specified, see: https://docs.gitlab.com/ee/user/namespace/"
            },
            "topics": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "List of project topics to exclude when syncing. Projects that match one of the provided `topics` will be excluded from syncing. Glob patterns are supported.",
              "examples": [
                [
                  "tests",
                  "ci"
                ]
              ]
            }
          },
          "additionalProperties": false
        },
        "revisions": {
          "$ref": "#/oneOf/0/properties/revisions"
        }
      },
      "required": [
        "type"
      ],
      "additionalProperties": false
    },
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "title": "GiteaConnectionConfig",
      "properties": {
        "type": {
          "const": "gitea",
          "description": "Gitea Configuration"
        },
        "token": {
          "$ref": "#/oneOf/0/properties/token",
          "description": "A Personal Access Token (PAT).",
          "examples": [
            {
              "secret": "SECRET_KEY"
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
          "$ref": "#/oneOf/0/properties/revisions"
        }
      },
      "required": [
        "type"
      ],
      "additionalProperties": false
    },
    {
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
    }
  ]
} as const;
export { schema as connectionSchema };