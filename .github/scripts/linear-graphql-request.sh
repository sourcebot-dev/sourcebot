#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "LINEAR_API_KEY is required" >&2
  exit 1
fi

payload=$(cat)
attempts="${LINEAR_GRAPHQL_ATTEMPTS:-4}"
retry_delay="${LINEAR_GRAPHQL_RETRY_DELAY_SECONDS:-2}"
endpoint="${LINEAR_GRAPHQL_ENDPOINT:-https://api.linear.app/graphql}"

for ((attempt = 1; attempt <= attempts; attempt++)); do
  response_file=$(mktemp)
  http_code=""

  if http_code=$(curl \
    --silent \
    --show-error \
    --output "$response_file" \
    --write-out '%{http_code}' \
    --connect-timeout 10 \
    --max-time 45 \
    -X POST "$endpoint" \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_KEY" \
    -d "$payload"); then
    response=$(<"$response_file")
    rm -f "$response_file"

    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]] && jq -e . >/dev/null 2>&1 <<<"$response"; then
      printf '%s' "$response"
      exit 0
    fi

    if [[ "$http_code" =~ ^(408|429|5[0-9][0-9])$ ]]; then
      echo "Linear GraphQL returned transient HTTP $http_code (attempt $attempt/$attempts)." >&2
    elif jq -e . >/dev/null 2>&1 <<<"$response"; then
      # Preserve structured non-retryable errors so the workflow can report
      # the GraphQL response rather than replacing it with a transport error.
      printf '%s' "$response"
      exit 0
    else
      echo "Linear GraphQL returned a non-JSON response (HTTP $http_code, attempt $attempt/$attempts)." >&2
    fi
  else
    curl_status=$?
    response=$(<"$response_file")
    rm -f "$response_file"
    echo "Linear GraphQL request failed (curl $curl_status, HTTP ${http_code:-unknown}, attempt $attempt/$attempts)." >&2
  fi

  if ((attempt < attempts)); then
    sleep "$retry_delay"
  fi
done

echo "Linear GraphQL did not return a valid JSON response after $attempts attempts." >&2
exit 1
