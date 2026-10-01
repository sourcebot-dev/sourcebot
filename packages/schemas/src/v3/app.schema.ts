// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
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
          "description": "The private key of the GitHub App.",
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
            },
            {
              "type": "object",
              "properties": {
                "file": {
                  "type": "string",
                  "description": "The path to a file that contains the token. The file is re-read each time the token is used, so its contents can be rotated without restarting Sourcebot (e.g., a mounted Kubernetes secret)."
                }
              },
              "required": [
                "file"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "azureKeyVaultSecret": {
                  "type": "string",
                  "description": "The identifier of an Azure Key Vault secret. Must be in the format `https://<vault-name>.vault.azure.net/secrets/<secret-name>` or `https://<vault-name>.vault.azure.net/secrets/<secret-name>/<version>`. If the version is omitted, the latest version is used. Authenticates using DefaultAzureCredential. See https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets"
                }
              },
              "required": [
                "azureKeyVaultSecret"
              ],
              "additionalProperties": false
            }
          ]
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
          "description": "The private key of the GitHub App.",
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
            },
            {
              "type": "object",
              "properties": {
                "file": {
                  "type": "string",
                  "description": "The path to a file that contains the token. The file is re-read each time the token is used, so its contents can be rotated without restarting Sourcebot (e.g., a mounted Kubernetes secret)."
                }
              },
              "required": [
                "file"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "azureKeyVaultSecret": {
                  "type": "string",
                  "description": "The identifier of an Azure Key Vault secret. Must be in the format `https://<vault-name>.vault.azure.net/secrets/<secret-name>` or `https://<vault-name>.vault.azure.net/secrets/<secret-name>/<version>`. If the version is omitted, the latest version is used. Authenticates using DefaultAzureCredential. See https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets"
                }
              },
              "required": [
                "azureKeyVaultSecret"
              ],
              "additionalProperties": false
            }
          ]
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
} as const;
export { schema as appSchema };