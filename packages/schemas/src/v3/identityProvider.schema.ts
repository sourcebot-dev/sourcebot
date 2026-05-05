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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'GitHub'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'GitLab'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Google'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Okta'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Keycloak'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Microsoft Entra ID'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Google Cloud IAP'."
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
    "BitbucketCloudIdentityProviderConfig": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "provider": {
          "const": "bitbucket-cloud"
        },
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen and account settings. Defaults to 'Bitbucket Cloud'."
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
    "AuthentikIdentityProviderConfig": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "provider": {
          "const": "authentik"
        },
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Authentik'."
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
    "JumpCloudIdentityProviderConfig": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "provider": {
          "const": "jumpcloud"
        },
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'JumpCloud'."
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
    "BitbucketServerIdentityProviderConfig": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "provider": {
          "const": "bitbucket-server"
        },
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen and account settings. Defaults to 'Bitbucket Server'."
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
          "description": "The URL of the Bitbucket Server/Data Center host.",
          "examples": [
            "https://bitbucket.example.com"
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
        "clientSecret",
        "baseUrl"
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'GitHub'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'GitLab'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Google'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Okta'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Keycloak'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Microsoft Entra ID'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Google Cloud IAP'."
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
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'Authentik'."
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
          "const": "bitbucket-cloud"
        },
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen and account settings. Defaults to 'Bitbucket Cloud'."
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
          "const": "jumpcloud"
        },
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen. Defaults to 'JumpCloud'."
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
          "const": "bitbucket-server"
        },
        "displayName": {
          "type": "string",
          "description": "Optional human-readable label shown on the login screen and account settings. Defaults to 'Bitbucket Server'."
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
          "description": "The URL of the Bitbucket Server/Data Center host.",
          "examples": [
            "https://bitbucket.example.com"
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
        "clientSecret",
        "baseUrl"
      ]
    }
  ]
} as const;
export { schema as identityProviderSchema };