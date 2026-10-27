#!/usr/bin/env bash
set -euo pipefail

# Mints a short-lived Linear OAuth access token for the workflow's Linear app
# using the client credentials grant, and prints it to stdout. The token is an
# `app` actor token, so anything created with it is attributed to the app
# rather than to a person. The app must have the client credentials grant
# enabled in its Linear settings.
#
# Requesting a token with different scopes revokes the app's existing tokens,
# including ones held by concurrently running workflows, so every workflow
# that shares the app requests this same fixed scope set.
#
# Usage: linear-app-token.sh

SCOPES="read,write"

if [[ -z "${LINEAR_OAUTH_CLIENT_ID:-}" || -z "${LINEAR_OAUTH_CLIENT_SECRET:-}" ]]; then
  echo "LINEAR_OAUTH_CLIENT_ID and LINEAR_OAUTH_CLIENT_SECRET are required" >&2
  exit 1
fi

endpoint="${LINEAR_OAUTH_TOKEN_ENDPOINT:-https://api.linear.app/oauth/token}"
response_file=$(mktemp)
trap 'rm -f "$response_file"' EXIT

if ! http_code=$(curl \
  --silent \
  --show-error \
  --output "$response_file" \
  --write-out '%{http_code}' \
  --connect-timeout 10 \
  --max-time 45 \
  --retry 2 \
  --retry-delay 2 \
  -X POST "$endpoint" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "scope=$SCOPES" \
  --data-urlencode "client_id=$LINEAR_OAUTH_CLIENT_ID" \
  --data-urlencode "client_secret=$LINEAR_OAUTH_CLIENT_SECRET"); then
  echo "Linear OAuth token request failed (HTTP ${http_code:-unknown})." >&2
  exit 1
fi

if [[ ! "$http_code" =~ ^2[0-9][0-9]$ ]] \
  || ! access_token=$(jq -er '.access_token | select(type == "string" and length > 0)' "$response_file" 2>/dev/null); then
  # Linear's OAuth errors ({error, error_description}) carry no credentials.
  echo "Linear OAuth token request was rejected (HTTP $http_code): $(jq -c '{error, error_description}' "$response_file" 2>/dev/null || echo 'non-JSON response')" >&2
  exit 1
fi

printf '%s\n' "$access_token"
