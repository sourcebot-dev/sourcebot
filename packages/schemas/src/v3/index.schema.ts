// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "SourcebotConfig",
  "definitions": {
    "Settings": {
      "type": "object",
      "description": "Defines the global settings for Sourcebot.",
      "properties": {
        "maxFileSize": {
          "type": "number",
          "description": "The maximum size of a file (in bytes) to be indexed. Files that exceed this maximum will not be indexed. Defaults to 2MB.",
          "minimum": 1
        },
        "maxTrigramCount": {
          "type": "number",
          "description": "The maximum number of trigrams per document. Files that exceed this maximum will not be indexed. Default to 20000.",
          "minimum": 1
        },
        "reindexIntervalMs": {
          "type": "number",
          "description": "The interval (in milliseconds) at which the indexer should re-index all repositories. Defaults to 1 hour.",
          "minimum": 1
        },
        "resyncConnectionIntervalMs": {
          "type": "number",
          "description": "The interval (in milliseconds) at which the connection manager should check for connections that need to be re-synced. Defaults to 24 hours.",
          "minimum": 1
        },
        "resyncConnectionPollingIntervalMs": {
          "type": "number",
          "description": "The polling rate (in milliseconds) at which the db should be checked for connections that need to be re-synced. Defaults to 1 second.",
          "minimum": 1
        },
        "reindexRepoPollingIntervalMs": {
          "type": "number",
          "description": "The polling rate (in milliseconds) at which the db should be checked for repos that should be re-indexed. Defaults to 1 second.",
          "minimum": 1
        },
        "maxConnectionSyncJobConcurrency": {
          "type": "number",
          "description": "The number of connection sync jobs to run concurrently. Defaults to 8.",
          "minimum": 1
        },
        "maxRepoIndexingJobConcurrency": {
          "type": "number",
          "description": "The number of repo indexing jobs to run concurrently. Defaults to 8.",
          "minimum": 1
        },
        "maxRepoGarbageCollectionJobConcurrency": {
          "type": "number",
          "description": "The number of repo GC jobs to run concurrently. Defaults to 8.",
          "minimum": 1
        },
        "repoGarbageCollectionGracePeriodMs": {
          "type": "number",
          "description": "The grace period (in milliseconds) for garbage collection. Used to prevent deleting shards while they're being loaded. Defaults to 10 seconds.",
          "minimum": 1
        },
        "repoIndexTimeoutMs": {
          "type": "number",
          "description": "The timeout (in milliseconds) for a repo indexing to timeout. Defaults to 2 hours.",
          "minimum": 1
        },
        "enablePublicAccess": {
          "type": "boolean",
          "deprecated": true,
          "description": "This setting is deprecated. Please use the `FORCE_ENABLE_ANONYMOUS_ACCESS` environment variable instead.",
          "default": false
        },
        "experiment_repoDrivenPermissionSyncIntervalMs": {
          "type": "number",
          "description": "The interval (in milliseconds) at which the repo permission syncer should run. Defaults to 24 hours.",
          "minimum": 1
        },
        "experiment_userDrivenPermissionSyncIntervalMs": {
          "type": "number",
          "description": "The interval (in milliseconds) at which the user permission syncer should run. Defaults to 24 hours.",
          "minimum": 1
        },
        "maxAccountPermissionSyncJobConcurrency": {
          "type": "number",
          "description": "The number of account permission sync jobs to run concurrently. Defaults to 8.",
          "minimum": 1
        },
        "maxRepoPermissionSyncJobConcurrency": {
          "type": "number",
          "description": "The number of repo permission sync jobs to run concurrently. Defaults to 8.",
          "minimum": 1
        }
      },
      "additionalProperties": false
    },
    "SearchContext": {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "title": "SearchContext",
      "description": "Search context",
      "properties": {
        "include": {
          "type": "array",
          "description": "List of repositories to include in the search context. Expected to be formatted as a URL without any leading http(s):// prefix (e.g., 'github.com/sourcebot-dev/sourcebot'). Glob patterns are supported.",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "github.com/sourcebot-dev/**",
              "gerrit.example.org/sub/path/**"
            ]
          ]
        },
        "includeConnections": {
          "type": "array",
          "description": "List of connections to include in the search context.",
          "items": {
            "type": "string"
          }
        },
        "exclude": {
          "type": "array",
          "description": "List of repositories to exclude from the search context. Expected to be formatted as a URL without any leading http(s):// prefix (e.g., 'github.com/sourcebot-dev/sourcebot'). Glob patterns are supported.",
          "items": {
            "type": "string"
          },
          "examples": [
            [
              "github.com/sourcebot-dev/sourcebot",
              "gerrit.example.org/sub/path/**"
            ]
          ]
        },
        "excludeConnections": {
          "type": "array",
          "description": "List of connections to exclude from the search context.",
          "items": {
            "type": "string"
          }
        },
        "description": {
          "type": "string",
          "description": "Optional description of the search context that surfaces in the UI."
        }
      },
      "additionalProperties": false
    }
  },
  "properties": {
    "$schema": {
      "type": "string"
    },
    "settings": {
      "type": "object",
      "description": "Defines the global settings for Sourcebot.",
      "properties": {
        "maxFileSize": {
          "type": "number",
          "description": "The maximum size of a file (in bytes) to be indexed. Files that exceed this maximum will not be indexed. Defaults to 2MB.",
          "minimum": 1
        },
        "maxTrigramCount": {
          "type": "number",
          "description": "The maximum number of trigrams per document. Files that exceed this maximum will not be indexed. Default to 20000.",
          "minimum": 1
        },
        "reindexIntervalMs": {
          "type": "number",
          "description": "The interval (in milliseconds) at which the indexer should re-index all repositories. Defaults to 1 hour.",
          "minimum": 1
        },
        "resyncConnectionIntervalMs": {
          "type": "number",
          "description": "The interval (in milliseconds) at which the connection manager should check for connections that need to be re-synced. Defaults to 24 hours.",
          "minimum": 1
        },
        "resyncConnectionPollingIntervalMs": {
          "type": "number",
          "description": "The polling rate (in milliseconds) at which the db should be checked for connections that need to be re-synced. Defaults to 1 second.",
          "minimum": 1
        },
        "reindexRepoPollingIntervalMs": {
          "type": "number",
          "description": "The polling rate (in milliseconds) at which the db should be checked for repos that should be re-indexed. Defaults to 1 second.",
          "minimum": 1
        },
        "maxConnectionSyncJobConcurrency": {
          "type": "number",
          "description": "The number of connection sync jobs to run concurrently. Defaults to 8.",
          "minimum": 1
        },
        "maxRepoIndexingJobConcurrency": {
          "type": "number",
          "description": "The number of repo indexing jobs to run concurrently. Defaults to 8.",
          "minimum": 1
        },
        "maxRepoGarbageCollectionJobConcurrency": {
          "type": "number",
          "description": "The number of repo GC jobs to run concurrently. Defaults to 8.",
          "minimum": 1
        },
        "repoGarbageCollectionGracePeriodMs": {
          "type": "number",
          "description": "The grace period (in milliseconds) for garbage collection. Used to prevent deleting shards while they're being loaded. Defaults to 10 seconds.",
          "minimum": 1
        },
        "repoIndexTimeoutMs": {
          "type": "number",
          "description": "The timeout (in milliseconds) for a repo indexing to timeout. Defaults to 2 hours.",
          "minimum": 1
        },
        "enablePublicAccess": {
          "type": "boolean",
          "deprecated": true,
          "description": "This setting is deprecated. Please use the `FORCE_ENABLE_ANONYMOUS_ACCESS` environment variable instead.",
          "default": false
        },
        "experiment_repoDrivenPermissionSyncIntervalMs": {
          "type": "number",
          "description": "The interval (in milliseconds) at which the repo permission syncer should run. Defaults to 24 hours.",
          "minimum": 1
        },
        "experiment_userDrivenPermissionSyncIntervalMs": {
          "type": "number",
          "description": "The interval (in milliseconds) at which the user permission syncer should run. Defaults to 24 hours.",
          "minimum": 1
        },
        "maxAccountPermissionSyncJobConcurrency": {
          "type": "number",
          "description": "The number of account permission sync jobs to run concurrently. Defaults to 8.",
          "minimum": 1
        },
        "maxRepoPermissionSyncJobConcurrency": {
          "type": "number",
          "description": "The number of repo permission sync jobs to run concurrently. Defaults to 8.",
          "minimum": 1
        }
      },
      "additionalProperties": false
    },
    "contexts": {
      "type": "object",
      "description": "[Sourcebot EE] Defines a collection of search contexts. This is only available in single-tenancy mode. See: https://docs.sourcebot.dev/docs/features/search/search-contexts",
      "patternProperties": {
        "^[a-zA-Z0-9_-]+$": {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "title": "SearchContext",
          "description": "Search context",
          "properties": {
            "include": {
              "type": "array",
              "description": "List of repositories to include in the search context. Expected to be formatted as a URL without any leading http(s):// prefix (e.g., 'github.com/sourcebot-dev/sourcebot'). Glob patterns are supported.",
              "items": {
                "type": "string"
              },
              "examples": [
                [
                  "github.com/sourcebot-dev/**",
                  "gerrit.example.org/sub/path/**"
                ]
              ]
            },
            "includeConnections": {
              "type": "array",
              "description": "List of connections to include in the search context.",
              "items": {
                "type": "string"
              }
            },
            "exclude": {
              "type": "array",
              "description": "List of repositories to exclude from the search context. Expected to be formatted as a URL without any leading http(s):// prefix (e.g., 'github.com/sourcebot-dev/sourcebot'). Glob patterns are supported.",
              "items": {
                "type": "string"
              },
              "examples": [
                [
                  "github.com/sourcebot-dev/sourcebot",
                  "gerrit.example.org/sub/path/**"
                ]
              ]
            },
            "excludeConnections": {
              "type": "array",
              "description": "List of connections to exclude from the search context.",
              "items": {
                "type": "string"
              }
            },
            "description": {
              "type": "string",
              "description": "Optional description of the search context that surfaces in the UI."
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "environmentOverrides": {
      "type": "object",
      "description": "Environment variable overrides.",
      "title": "EnvironmentOverrides",
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
    },
    "connections": {
      "type": "object",
      "description": "Defines a collection of connections from varying code hosts that Sourcebot should sync with. This is only available in single-tenancy mode.",
      "patternProperties": {
        "^[a-zA-Z0-9_-]+$": {
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
                  ],
                  "description": "A Personal Access Token (PAT)."
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
                  ],
                  "description": "An authentication token."
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
                "minAccessLevel": {
                  "type": "integer",
                  "enum": [
                    5,
                    10,
                    20,
                    30,
                    40,
                    50
                  ],
                  "description": "Minimum GitLab access level required for projects to be returned. Uses GitLab role levels where 20=Reporter, 30=Developer, 40=Maintainer, and 50=Owner."
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
                    "userOwnedProjects": {
                      "type": "boolean",
                      "default": false,
                      "description": "Exclude user-owned projects from syncing."
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
                    },
                    "size": {
                      "type": "object",
                      "description": "Exclude projects based on GitLab statistics size fields (in bytes).",
                      "properties": {
                        "min": {
                          "type": "integer",
                          "description": "Minimum project size (in bytes) to sync (inclusive). Projects smaller than this will be excluded."
                        },
                        "max": {
                          "type": "integer",
                          "description": "Maximum project size (in bytes) to sync (inclusive). Projects larger than this will be excluded."
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
              "title": "GiteaConnectionConfig",
              "properties": {
                "type": {
                  "const": "gitea",
                  "description": "Gitea Configuration"
                },
                "token": {
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
                  ],
                  "description": "A Personal Access Token (PAT)."
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
                "type",
                "url"
              ],
              "additionalProperties": false
            },
            {
              "$schema": "http://json-schema.org/draft-07/schema#",
              "type": "object",
              "title": "BitbucketConnectionConfig",
              "properties": {
                "type": {
                  "const": "bitbucket",
                  "description": "Bitbucket configuration"
                },
                "user": {
                  "type": "string",
                  "description": "The username to use for authentication. Only needed if token is an app password."
                },
                "token": {
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
                  ],
                  "description": "An authentication token."
                },
                "url": {
                  "type": "string",
                  "format": "url",
                  "default": "https://api.bitbucket.org/2.0",
                  "description": "Bitbucket URL",
                  "examples": [
                    "https://bitbucket.example.com"
                  ],
                  "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$"
                },
                "deploymentType": {
                  "type": "string",
                  "enum": [
                    "cloud",
                    "server"
                  ],
                  "default": "cloud",
                  "description": "The type of Bitbucket deployment"
                },
                "workspaces": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "List of workspaces to sync. Ignored if deploymentType is server."
                },
                "projects": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "List of projects to sync"
                },
                "repos": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "List of repos to sync"
                },
                "exclude": {
                  "type": "object",
                  "properties": {
                    "archived": {
                      "type": "boolean",
                      "default": false,
                      "description": "Exclude archived repositories from syncing."
                    },
                    "forks": {
                      "type": "boolean",
                      "default": false,
                      "description": "Exclude forked repositories from syncing."
                    },
                    "repos": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      },
                      "examples": [
                        [
                          "cloud_workspace/PROJECT_KEY/repo1",
                          "SERVER_PROJECT_KEY/repo2"
                        ]
                      ],
                      "description": "List of specific repos to exclude from syncing."
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
              "if": {
                "properties": {
                  "deploymentType": {
                    "const": "server"
                  }
                }
              },
              "then": {
                "required": [
                  "url"
                ]
              },
              "additionalProperties": false
            },
            {
              "$schema": "http://json-schema.org/draft-07/schema#",
              "type": "object",
              "title": "AzureDevOpsConnectionConfig",
              "properties": {
                "type": {
                  "const": "azuredevops",
                  "description": "Azure DevOps Configuration"
                },
                "token": {
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
                  ],
                  "description": "A Personal Access Token (PAT)."
                },
                "url": {
                  "type": "string",
                  "format": "url",
                  "default": "https://dev.azure.com",
                  "description": "The URL of the Azure DevOps host. For Azure DevOps Cloud, use https://dev.azure.com. For Azure DevOps Server, use your server URL.",
                  "examples": [
                    "https://dev.azure.com",
                    "https://azuredevops.example.com"
                  ],
                  "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$"
                },
                "deploymentType": {
                  "type": "string",
                  "enum": [
                    "cloud",
                    "server"
                  ],
                  "description": "The type of Azure DevOps deployment"
                },
                "useTfsPath": {
                  "type": "boolean",
                  "default": false,
                  "description": "Use legacy TFS path format (/tfs) in API URLs. Required for older TFS installations (TFS 2018 and earlier). When true, API URLs will include /tfs in the path (e.g., https://server/tfs/collection/_apis/...)."
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
                      "my-org"
                    ]
                  ],
                  "description": "List of organizations to sync with. For Cloud, this is the organization name. For Server, this is the collection name. All projects and repositories visible to the provided `token` will be synced, unless explicitly defined in the `exclude` property."
                },
                "projects": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "pattern": "^[\\w.-]+\\/[\\w.-]+$"
                  },
                  "default": [],
                  "examples": [
                    [
                      "my-org/my-project",
                      "my-collection/my-project"
                    ]
                  ],
                  "description": "List of specific projects to sync with. Expected to be formatted as '{orgName}/{projectName}' for Cloud or '{collectionName}/{projectName}' for Server."
                },
                "repos": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "pattern": "^[\\w.-]+\\/[\\w.-]+\\/[\\w.-]+$"
                  },
                  "default": [],
                  "examples": [
                    [
                      "my-org/my-project/my-repo"
                    ]
                  ],
                  "description": "List of individual repositories to sync with. Expected to be formatted as '{orgName}/{projectName}/{repoName}'."
                },
                "exclude": {
                  "type": "object",
                  "properties": {
                    "disabled": {
                      "type": "boolean",
                      "default": false,
                      "description": "Exclude disabled repositories from syncing."
                    },
                    "repos": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      },
                      "default": [],
                      "description": "List of repositories to exclude from syncing. Glob patterns are supported."
                    },
                    "projects": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      },
                      "default": [],
                      "description": "List of projects to exclude from syncing. Glob patterns are supported."
                    },
                    "size": {
                      "type": "object",
                      "description": "Exclude repositories based on their size.",
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
                "type",
                "token",
                "deploymentType"
              ],
              "additionalProperties": false
            },
            {
              "$schema": "http://json-schema.org/draft-07/schema#",
              "type": "object",
              "title": "GenericGitHostConnectionConfig",
              "properties": {
                "type": {
                  "const": "git",
                  "description": "Generic Git host configuration"
                },
                "url": {
                  "type": "string",
                  "format": "url",
                  "description": "The URL to the git repository. This can either be a remote URL (prefixed with `http://` or `https://`) or a absolute path to a directory on the local machine (prefixed with `file://`). If a local directory is specified, it must point to the root of a git repository. Local directories are treated as read-only modified. Local directories support glob patterns.",
                  "pattern": "^(https?:\\/\\/[^\\s/$.?#].[^\\s]*|file:\\/\\/\\/[^\\s]+)$",
                  "examples": [
                    "https://github.com/sourcebot-dev/sourcebot",
                    "file:///path/to/repo",
                    "file:///repos/*"
                  ]
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
                "type",
                "url"
              ],
              "additionalProperties": false
            }
          ]
        }
      },
      "additionalProperties": false
    },
    "models": {
      "type": "array",
      "description": "Defines a collection of language models that are available to Sourcebot.",
      "items": {
        "type": "object",
        "title": "LanguageModel",
        "definitions": {
          "AmazonBedrockLanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "amazon-bedrock",
                "description": "Amazon Bedrock Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "accessKeyId": {
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
                ],
                "description": "Optional access key ID to use with the model. Defaults to the `AWS_ACCESS_KEY_ID` environment variable."
              },
              "accessKeySecret": {
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
                ],
                "description": "Optional secret access key to use with the model. Defaults to the `AWS_SECRET_ACCESS_KEY` environment variable."
              },
              "sessionToken": {
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
                ],
                "description": "Optional session token to use with the model. Defaults to the `AWS_SESSION_TOKEN` environment variable."
              },
              "region": {
                "type": "string",
                "description": "The AWS region. Defaults to the `AWS_REGION` environment variable.",
                "examples": [
                  "us-east-1",
                  "us-west-2",
                  "eu-west-1"
                ]
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          "AnthropicLanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "anthropic",
                "description": "Anthropic Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `ANTHROPIC_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          "AzureLanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "azure",
                "description": "Azure Configuration"
              },
              "model": {
                "type": "string",
                "description": "The deployment name of the Azure model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "resourceName": {
                "type": "string",
                "description": "Azure resource name. Defaults to the `AZURE_RESOURCE_NAME` environment variable."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `AZURE_API_KEY` environment variable."
              },
              "apiVersion": {
                "type": "string",
                "description": "Sets a custom api version. Defaults to `preview`."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Use a different URL prefix for API calls. Either this or `resourceName` can be used."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          "DeepSeekLanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "deepseek",
                "description": "DeepSeek Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `DEEPSEEK_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          "GoogleGenerativeAILanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "google-generative-ai",
                "description": "Google Generative AI Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `GOOGLE_GENERATIVE_AI_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          "GoogleVertexAnthropicLanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "google-vertex-anthropic",
                "description": "Google Vertex AI Anthropic Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the Anthropic language model running on Google Vertex.",
                "examples": [
                  "claude-sonnet-4"
                ]
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "project": {
                "type": "string",
                "description": "The Google Cloud project ID. Defaults to the `GOOGLE_VERTEX_PROJECT` environment variable."
              },
              "region": {
                "type": "string",
                "description": "The Google Cloud region. Defaults to the `GOOGLE_VERTEX_REGION` environment variable.",
                "examples": [
                  "us-central1",
                  "us-east1",
                  "europe-west1"
                ]
              },
              "credentials": {
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
                ],
                "description": "Optional file path to service account credentials JSON. Defaults to the `GOOGLE_APPLICATION_CREDENTIALS` environment variable or application default credentials."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          "GoogleVertexLanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "google-vertex",
                "description": "Google Vertex AI Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model.",
                "examples": [
                  "gemini-2.0-flash-exp",
                  "gemini-1.5-pro",
                  "gemini-1.5-flash"
                ]
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "project": {
                "type": "string",
                "description": "The Google Cloud project ID. Defaults to the `GOOGLE_VERTEX_PROJECT` environment variable."
              },
              "region": {
                "type": "string",
                "description": "The Google Cloud region. Defaults to the `GOOGLE_VERTEX_REGION` environment variable.",
                "examples": [
                  "us-central1",
                  "us-east1",
                  "europe-west1"
                ]
              },
              "credentials": {
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
                ],
                "description": "Optional file path to service account credentials JSON. Defaults to the `GOOGLE_APPLICATION_CREDENTIALS` environment variable or application default credentials."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          "MistralLanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "mistral",
                "description": "Mistral AI Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `MISTRAL_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          "OpenAILanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "openai",
                "description": "OpenAI Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model.",
                "examples": [
                  "gpt-4.1",
                  "o4-mini",
                  "o3",
                  "o3-deep-research"
                ]
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `OPENAI_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "reasoningEffort": {
                "type": "string",
                "description": "The reasoning effort to use with the model. Defaults to `medium`. See https://platform.openai.com/docs/guides/reasoning#get-started-with-reasonings",
                "examples": [
                  "minimal",
                  "low",
                  "medium",
                  "high"
                ]
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          "OpenAICompatibleLanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "openai-compatible",
                "description": "OpenAI Compatible Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key. If specified, adds an `Authorization` header to request headers with the value Bearer <token>."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Base URL of the OpenAI-compatible chat completions API endpoint.",
                "examples": [
                  "http://localhost:8080/v1"
                ]
              },
              "headers": {
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
              "queryParams": {
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
              "reasoningTag": {
                "type": "string",
                "description": "The name of the XML tag to extract reasoning from (without angle brackets). Defaults to `think`.",
                "default": "think",
                "examples": [
                  "think",
                  "thinking",
                  "reasoning"
                ]
              }
            },
            "required": [
              "provider",
              "model",
              "baseUrl"
            ],
            "additionalProperties": false
          },
          "OpenRouterLanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "openrouter",
                "description": "OpenRouter Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `OPENROUTER_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          "XaiLanguageModel": {
            "type": "object",
            "properties": {
              "provider": {
                "const": "xai",
                "description": "xAI Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model.",
                "examples": [
                  "grok-beta",
                  "grok-vision-beta"
                ]
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `XAI_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          }
        },
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "amazon-bedrock",
                "description": "Amazon Bedrock Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "accessKeyId": {
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
                ],
                "description": "Optional access key ID to use with the model. Defaults to the `AWS_ACCESS_KEY_ID` environment variable."
              },
              "accessKeySecret": {
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
                ],
                "description": "Optional secret access key to use with the model. Defaults to the `AWS_SECRET_ACCESS_KEY` environment variable."
              },
              "sessionToken": {
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
                ],
                "description": "Optional session token to use with the model. Defaults to the `AWS_SESSION_TOKEN` environment variable."
              },
              "region": {
                "type": "string",
                "description": "The AWS region. Defaults to the `AWS_REGION` environment variable.",
                "examples": [
                  "us-east-1",
                  "us-west-2",
                  "eu-west-1"
                ]
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "anthropic",
                "description": "Anthropic Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `ANTHROPIC_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "azure",
                "description": "Azure Configuration"
              },
              "model": {
                "type": "string",
                "description": "The deployment name of the Azure model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "resourceName": {
                "type": "string",
                "description": "Azure resource name. Defaults to the `AZURE_RESOURCE_NAME` environment variable."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `AZURE_API_KEY` environment variable."
              },
              "apiVersion": {
                "type": "string",
                "description": "Sets a custom api version. Defaults to `preview`."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Use a different URL prefix for API calls. Either this or `resourceName` can be used."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "deepseek",
                "description": "DeepSeek Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `DEEPSEEK_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "google-generative-ai",
                "description": "Google Generative AI Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `GOOGLE_GENERATIVE_AI_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "google-vertex-anthropic",
                "description": "Google Vertex AI Anthropic Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the Anthropic language model running on Google Vertex.",
                "examples": [
                  "claude-sonnet-4"
                ]
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "project": {
                "type": "string",
                "description": "The Google Cloud project ID. Defaults to the `GOOGLE_VERTEX_PROJECT` environment variable."
              },
              "region": {
                "type": "string",
                "description": "The Google Cloud region. Defaults to the `GOOGLE_VERTEX_REGION` environment variable.",
                "examples": [
                  "us-central1",
                  "us-east1",
                  "europe-west1"
                ]
              },
              "credentials": {
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
                ],
                "description": "Optional file path to service account credentials JSON. Defaults to the `GOOGLE_APPLICATION_CREDENTIALS` environment variable or application default credentials."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "google-vertex",
                "description": "Google Vertex AI Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model.",
                "examples": [
                  "gemini-2.0-flash-exp",
                  "gemini-1.5-pro",
                  "gemini-1.5-flash"
                ]
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "project": {
                "type": "string",
                "description": "The Google Cloud project ID. Defaults to the `GOOGLE_VERTEX_PROJECT` environment variable."
              },
              "region": {
                "type": "string",
                "description": "The Google Cloud region. Defaults to the `GOOGLE_VERTEX_REGION` environment variable.",
                "examples": [
                  "us-central1",
                  "us-east1",
                  "europe-west1"
                ]
              },
              "credentials": {
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
                ],
                "description": "Optional file path to service account credentials JSON. Defaults to the `GOOGLE_APPLICATION_CREDENTIALS` environment variable or application default credentials."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "mistral",
                "description": "Mistral AI Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `MISTRAL_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "openai",
                "description": "OpenAI Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model.",
                "examples": [
                  "gpt-4.1",
                  "o4-mini",
                  "o3",
                  "o3-deep-research"
                ]
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `OPENAI_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "reasoningEffort": {
                "type": "string",
                "description": "The reasoning effort to use with the model. Defaults to `medium`. See https://platform.openai.com/docs/guides/reasoning#get-started-with-reasonings",
                "examples": [
                  "minimal",
                  "low",
                  "medium",
                  "high"
                ]
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "openai-compatible",
                "description": "OpenAI Compatible Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key. If specified, adds an `Authorization` header to request headers with the value Bearer <token>."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Base URL of the OpenAI-compatible chat completions API endpoint.",
                "examples": [
                  "http://localhost:8080/v1"
                ]
              },
              "headers": {
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
              "queryParams": {
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
              "reasoningTag": {
                "type": "string",
                "description": "The name of the XML tag to extract reasoning from (without angle brackets). Defaults to `think`.",
                "default": "think",
                "examples": [
                  "think",
                  "thinking",
                  "reasoning"
                ]
              }
            },
            "required": [
              "provider",
              "model",
              "baseUrl"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "openrouter",
                "description": "OpenRouter Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model."
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `OPENROUTER_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "const": "xai",
                "description": "xAI Configuration"
              },
              "model": {
                "type": "string",
                "description": "The name of the language model.",
                "examples": [
                  "grok-beta",
                  "grok-vision-beta"
                ]
              },
              "displayName": {
                "type": "string",
                "description": "Optional display name."
              },
              "token": {
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
                ],
                "description": "Optional API key to use with the model. Defaults to the `XAI_API_KEY` environment variable."
              },
              "baseUrl": {
                "type": "string",
                "format": "url",
                "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
                "description": "Optional base URL."
              },
              "headers": {
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
              }
            },
            "required": [
              "provider",
              "model"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "apps": {
      "type": "array",
      "description": "Defines a collection of apps that are available to Sourcebot.",
      "items": {
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
                ],
                "description": "The private key of the GitHub App."
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
                ],
                "description": "The private key of the GitHub App."
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
      }
    },
    "identityProviders": {
      "type": "array",
      "description": "Defines a collection of identity providers that are available to Sourcebot.",
      "items": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "IdentityProviderConfig",
        "definitions": {
          "GitHubIdentityProviderConfig": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "github"
              },
              "purpose": {
                "enum": [
                  "sso",
                  "account_linking"
                ]
              },
              "clientId": {
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
              "clientSecret": {
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
              "baseUrl": {
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
              "accountLinkingRequired": {
                "type": "boolean",
                "default": false
              }
            },
            "required": [
              "provider",
              "purpose",
              "clientId",
              "clientSecret"
            ]
          },
          "GitLabIdentityProviderConfig": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "gitlab"
              },
              "purpose": {
                "enum": [
                  "sso",
                  "account_linking"
                ]
              },
              "clientId": {
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
              "clientSecret": {
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
              "baseUrl": {
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
              "accountLinkingRequired": {
                "type": "boolean",
                "default": false
              }
            },
            "required": [
              "provider",
              "purpose",
              "clientId",
              "clientSecret"
            ]
          },
          "GoogleIdentityProviderConfig": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "google"
              },
              "purpose": {
                "const": "sso"
              },
              "clientId": {
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
              "clientSecret": {
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
              "provider",
              "purpose",
              "clientId",
              "clientSecret"
            ]
          },
          "OktaIdentityProviderConfig": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "okta"
              },
              "purpose": {
                "const": "sso"
              },
              "clientId": {
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
              "clientSecret": {
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
              "issuer": {
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
              "provider",
              "purpose",
              "clientId",
              "clientSecret",
              "issuer"
            ]
          },
          "KeycloakIdentityProviderConfig": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "keycloak"
              },
              "purpose": {
                "const": "sso"
              },
              "clientId": {
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
              "clientSecret": {
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
              "issuer": {
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
              "provider",
              "purpose",
              "clientId",
              "clientSecret",
              "issuer"
            ]
          },
          "MicrosoftEntraIDIdentityProviderConfig": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "microsoft-entra-id"
              },
              "purpose": {
                "const": "sso"
              },
              "clientId": {
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
              "clientSecret": {
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
              "issuer": {
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
              "provider",
              "purpose",
              "clientId",
              "clientSecret",
              "issuer"
            ]
          },
          "GCPIAPIdentityProviderConfig": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "gcp-iap"
              },
              "purpose": {
                "const": "sso"
              },
              "audience": {
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
              "provider",
              "purpose",
              "audience"
            ]
          },
          "AuthentikIdentityProviderConfig": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "authentik"
              },
              "purpose": {
                "const": "sso"
              },
              "clientId": {
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
              "clientSecret": {
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
              "issuer": {
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
              "provider",
              "purpose",
              "clientId",
              "clientSecret",
              "issuer"
            ]
          }
        },
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "github"
              },
              "purpose": {
                "enum": [
                  "sso",
                  "account_linking"
                ]
              },
              "clientId": {
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
              "clientSecret": {
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
              "baseUrl": {
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
              "accountLinkingRequired": {
                "type": "boolean",
                "default": false
              }
            },
            "required": [
              "provider",
              "purpose",
              "clientId",
              "clientSecret"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "gitlab"
              },
              "purpose": {
                "enum": [
                  "sso",
                  "account_linking"
                ]
              },
              "clientId": {
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
              "clientSecret": {
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
              "baseUrl": {
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
              "accountLinkingRequired": {
                "type": "boolean",
                "default": false
              }
            },
            "required": [
              "provider",
              "purpose",
              "clientId",
              "clientSecret"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "google"
              },
              "purpose": {
                "const": "sso"
              },
              "clientId": {
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
              "clientSecret": {
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
              "provider",
              "purpose",
              "clientId",
              "clientSecret"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "okta"
              },
              "purpose": {
                "const": "sso"
              },
              "clientId": {
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
              "clientSecret": {
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
              "issuer": {
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
              "provider",
              "purpose",
              "clientId",
              "clientSecret",
              "issuer"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "keycloak"
              },
              "purpose": {
                "const": "sso"
              },
              "clientId": {
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
              "clientSecret": {
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
              "issuer": {
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
              "provider",
              "purpose",
              "clientId",
              "clientSecret",
              "issuer"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "microsoft-entra-id"
              },
              "purpose": {
                "const": "sso"
              },
              "clientId": {
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
              "clientSecret": {
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
              "issuer": {
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
              "provider",
              "purpose",
              "clientId",
              "clientSecret",
              "issuer"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "gcp-iap"
              },
              "purpose": {
                "const": "sso"
              },
              "audience": {
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
              "provider",
              "purpose",
              "audience"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "provider": {
                "const": "authentik"
              },
              "purpose": {
                "const": "sso"
              },
              "clientId": {
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
              "clientSecret": {
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
              "issuer": {
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
              "provider",
              "purpose",
              "clientId",
              "clientSecret",
              "issuer"
            ]
          }
        ]
      }
    }
  },
  "additionalProperties": false
} as const;
export { schema as indexSchema };