// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "IdentityProviderConfig",
  "definitions": {
    "GitHubIdentityProviderConfig": {
      "type": "object",
      "properties": {
        "provider": {
          "const": "github"
        },
        "purpose": {
          "enum": [
            "sso",
            "integration"
          ]
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "baseUrl": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "required": {
          "type": "boolean",
          "default": true
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
      "properties": {
        "provider": {
          "const": "gitlab"
        },
        "purpose": {
          "enum": [
            "sso",
            "integration"
          ]
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "baseUrl": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "required": {
          "type": "boolean",
          "default": true
        }
      },
      "required": [
        "provider",
        "purpose",
        "clientId",
        "clientSecret",
        "baseUrl"
      ]
    },
    "GoogleIdentityProviderConfig": {
      "type": "object",
      "properties": {
        "provider": {
          "const": "google"
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
      },
      "required": [
        "provider",
        "clientId",
        "clientSecret"
      ]
    },
    "OktaIdentityProviderConfig": {
      "type": "object",
      "properties": {
        "provider": {
          "const": "okta"
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "issuer": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
      },
      "required": [
        "provider",
        "clientId",
        "clientSecret",
        "issuer"
      ]
    },
    "KeycloakIdentityProviderConfig": {
      "type": "object",
      "properties": {
        "provider": {
          "const": "keycloak"
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "issuer": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
      },
      "required": [
        "provider",
        "clientId",
        "clientSecret",
        "issuer"
      ]
    },
    "MicrosoftEntraIDIdentityProviderConfig": {
      "type": "object",
      "properties": {
        "provider": {
          "const": "microsoft-entra-id"
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "issuer": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
      },
      "required": [
        "provider",
        "clientId",
        "clientSecret",
        "issuer"
      ]
    },
    "GCPIAPIdentityProviderConfig": {
      "type": "object",
      "properties": {
        "provider": {
          "const": "gcp-iap"
        },
        "audience": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
      },
      "required": [
        "provider",
        "audience"
      ]
    }
  },
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "provider": {
          "const": "github"
        },
        "purpose": {
          "enum": [
            "sso",
            "integration"
          ]
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "baseUrl": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "required": {
          "type": "boolean",
          "default": true
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
      "properties": {
        "provider": {
          "const": "gitlab"
        },
        "purpose": {
          "enum": [
            "sso",
            "integration"
          ]
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "baseUrl": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "required": {
          "type": "boolean",
          "default": true
        }
      },
      "required": [
        "provider",
        "purpose",
        "clientId",
        "clientSecret",
        "baseUrl"
      ]
    },
    {
      "type": "object",
      "properties": {
        "provider": {
          "const": "google"
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
      },
      "required": [
        "provider",
        "clientId",
        "clientSecret"
      ]
    },
    {
      "type": "object",
      "properties": {
        "provider": {
          "const": "okta"
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "issuer": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
      },
      "required": [
        "provider",
        "clientId",
        "clientSecret",
        "issuer"
      ]
    },
    {
      "type": "object",
      "properties": {
        "provider": {
          "const": "keycloak"
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "issuer": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
      },
      "required": [
        "provider",
        "clientId",
        "clientSecret",
        "issuer"
      ]
    },
    {
      "type": "object",
      "properties": {
        "provider": {
          "const": "microsoft-entra-id"
        },
        "clientId": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "clientSecret": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
        "issuer": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
      },
      "required": [
        "provider",
        "clientId",
        "clientSecret",
        "issuer"
      ]
    },
    {
      "type": "object",
      "properties": {
        "provider": {
          "const": "gcp-iap"
        },
        "audience": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "env": {
                  "type": "string",
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
      },
      "required": [
        "provider",
        "audience"
      ]
    }
  ]
} as const;
export { schema as identityProviderSchema };