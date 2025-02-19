// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "definitions": {
    "Token": {
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
    "GitRevisions": {
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
  }
} as const;
export { schema as sharedSchema };