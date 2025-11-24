// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
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
} as const;
export { schema as identityProviderSchema };