// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "definitions": {
    "RepoNameRegexIncludeFilter": {
      "type": "string",
      "description": "Only clone repos whose name matches the given regexp.",
      "format": "regexp",
      "default": "^(foo|bar)$"
    },
    "RepoNameRegexExcludeFilter": {
      "type": "string",
      "description": "Don't mirror repos whose names match this regexp.",
      "format": "regexp",
      "default": "^(fizz|buzz)$"
    },
    "ZoektConfig": {
      "anyOf": [
        {
          "$ref": "#/definitions/GitHubConfig"
        },
        {
          "$ref": "#/definitions/GitLabConfig"
        }
      ]
    },
    "GitHubConfig": {
      "type": "object",
      "properties": {
        "Type": {
          "const": "github"
        },
        "GitHubUrl": {
          "type": "string",
          "description": "GitHub Enterprise url. If not set github.com will be used as the host."
        },
        "GitHubUser": {
          "type": "string",
          "description": "The GitHub user to mirror"
        },
        "GitHubOrg": {
          "type": "string",
          "description": "The GitHub organization to mirror"
        },
        "Name": {
          "$ref": "#/definitions/RepoNameRegexIncludeFilter"
        },
        "Exclude": {
          "$ref": "#/definitions/RepoNameRegexExcludeFilter"
        },
        "CredentialPath": {
          "type": "string",
          "description": "Path to a file containing a GitHub access token.",
          "default": "~/.github-token"
        },
        "Topics": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Only mirror repos that have one of the given topics"
        },
        "ExcludeTopics": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Don't mirror repos that have one of the given topics"
        },
        "NoArchived": {
          "type": "boolean",
          "description": "Mirror repos that are _not_ archived",
          "default": false
        },
        "IncludeForks": {
          "type": "boolean",
          "description": "Also mirror forks",
          "default": false
        }
      },
      "required": [
        "Type"
      ],
      "additionalProperties": false
    },
    "GitLabConfig": {
      "type": "object",
      "properties": {
        "Type": {
          "const": "gitlab"
        },
        "GitLabURL": {
          "type": "string",
          "description": "The GitLab API url.",
          "default": "https://gitlab.com/api/v4/"
        },
        "Name": {
          "$ref": "#/definitions/RepoNameRegexIncludeFilter"
        },
        "Exclude": {
          "$ref": "#/definitions/RepoNameRegexExcludeFilter"
        },
        "OnlyPublic": {
          "type": "boolean",
          "description": "Only mirror public repos",
          "default": false
        },
        "CredentialPath": {
          "type": "string",
          "description": "Path to a file containing a GitLab access token.",
          "default": "~/.gitlab-token"
        }
      },
      "required": [
        "Type"
      ],
      "additionalProperties": false
    }
  },
  "properties": {
    "$schema": {
      "type": "string"
    },
    "Configs": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/ZoektConfig"
      }
    }
  },
  "required": [
    "Configs"
  ],
  "additionalProperties": false
} as const;
export { schema as indexSchema };