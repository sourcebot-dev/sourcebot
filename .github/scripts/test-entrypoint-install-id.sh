#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_ROOT=$(mktemp -d)
trap 'rm -rf "$TEST_ROOT"' EXIT

FAKE_BIN="$TEST_ROOT/bin"
UUIDGEN_LOG="$TEST_ROOT/uuidgen.log"
CURL_PAYLOAD_FILE="$TEST_ROOT/curl-payload.json"
mkdir -p "$FAKE_BIN"
: > "$UUIDGEN_LOG"

cat > "$FAKE_BIN/uuidgen" <<'EOF'
#!/usr/bin/env bash
if [[ "${UUIDGEN_SHOULD_FAIL:-false}" == "true" ]]; then
  exit 1
fi
printf 'called\n' >> "$UUIDGEN_LOG"
printf 'generated-install-id\n'
EOF

cat > "$FAKE_BIN/curl" <<'EOF'
#!/usr/bin/env bash
while (($# > 0)); do
  if [[ "$1" == "-d" ]]; then
    printf '%s\n' "$2" > "$CURL_PAYLOAD_FILE"
    exit 0
  fi
  shift
done
exit 1
EOF

cat > "$FAKE_BIN/yarn" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat > "$FAKE_BIN/mkdir" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat > "$FAKE_BIN/supervisord" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$SOURCEBOT_INSTALL_ID" > "$RESULT_FILE"
EOF

chmod +x "$FAKE_BIN/uuidgen" "$FAKE_BIN/curl" "$FAKE_BIN/yarn" "$FAKE_BIN/mkdir" "$FAKE_BIN/supervisord"

run_entrypoint() {
  local data_dir="$1"
  local result_file="$2"
  shift 2

  env \
    PATH="$FAKE_BIN:$PATH" \
    UUIDGEN_LOG="$UUIDGEN_LOG" \
    UUIDGEN_SHOULD_FAIL="false" \
    CURL_PAYLOAD_FILE="$CURL_PAYLOAD_FILE" \
    RESULT_FILE="$result_file" \
    DATA_CACHE_DIR="$data_dir" \
    DATABASE_URL="postgresql://test" \
    REDIS_URL="redis://test" \
    SOURCEBOT_ENCRYPTION_KEY="test-encryption-key" \
    AUTH_SECRET="test-auth-secret" \
    AUTH_URL="http://localhost:3000" \
    SOURCEBOT_TELEMETRY_DISABLED="true" \
    "$@" \
    /bin/sh "$REPO_ROOT/entrypoint.sh" >/dev/null
}

assert_equals() {
  local description="$1"
  local actual="$2"
  local expected="$3"

  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $description"
    echo "Expected: $expected"
    echo "Actual:   $actual"
    exit 1
  fi
}

supplied_data="$TEST_ROOT/supplied-data"
supplied_result="$TEST_ROOT/supplied-result"
supplied_id=$'supplied"install\\id\nsecond-line'
mkdir -p "$supplied_data"
run_entrypoint "$supplied_data" "$supplied_result" SOURCEBOT_INSTALL_ID="$supplied_id" SOURCEBOT_TELEMETRY_DISABLED="false" POSTHOG_PAPIK="test-project-key"
assert_equals "uses the supplied install ID on first boot" "$(<"$supplied_result")" "$supplied_id"
assert_equals "persists the supplied install ID as valid JSON" "$(jq -r '.install_id' "$supplied_data/.installedv3")" "$supplied_id"
assert_equals "does not generate an ID when one is supplied" "$(wc -l < "$UUIDGEN_LOG" | tr -d ' ')" "0"
if ! jq -e --arg expected "$supplied_id" \
  '.event == "install" and .distinct_id == $expected and .api_key == "test-project-key"' \
  "$CURL_PAYLOAD_FILE" >/dev/null; then
  echo "FAIL: install telemetry payload did not safely encode the supplied install ID"
  exit 1
fi

# Exercise the next-boot read and upgrade telemetry paths with the same escaped ID.
jq -n --arg install_id "$supplied_id" \
  '{version: "previous-version", install_id: $install_id}' > "$supplied_data/.installedv3"
supplied_restart_result="$TEST_ROOT/supplied-restart-result"
run_entrypoint "$supplied_data" "$supplied_restart_result" SOURCEBOT_INSTALL_ID="conflicting-install-id" SOURCEBOT_TELEMETRY_DISABLED="false" POSTHOG_PAPIK="test-project-key"
assert_equals "reads the escaped install ID on the next boot" "$(<"$supplied_restart_result")" "$supplied_id"
if ! jq -e --arg expected "$supplied_id" \
  '.event == "upgrade" and .distinct_id == $expected and .api_key == "test-project-key"' \
  "$CURL_PAYLOAD_FILE" >/dev/null; then
  echo "FAIL: upgrade telemetry payload did not safely encode the persisted install ID"
  exit 1
fi

generated_data="$TEST_ROOT/generated-data"
generated_result="$TEST_ROOT/generated-result"
mkdir -p "$generated_data"
run_entrypoint "$generated_data" "$generated_result" SOURCEBOT_INSTALL_ID=""
assert_equals "generates an install ID when none is supplied" "$(<"$generated_result")" "generated-install-id"
assert_equals "persists the generated install ID" "$(jq -r '.install_id' "$generated_data/.installedv3")" "generated-install-id"
assert_equals "generates exactly one install ID" "$(wc -l < "$UUIDGEN_LOG" | tr -d ' ')" "1"

existing_data="$TEST_ROOT/existing-data"
existing_result="$TEST_ROOT/existing-result"
mkdir -p "$existing_data"
printf '{"version":"existing-version","install_id":"persisted-install-id"}\n' > "$existing_data/.installedv3"
run_entrypoint "$existing_data" "$existing_result" SOURCEBOT_INSTALL_ID="conflicting-install-id"
assert_equals "keeps the persisted install ID after first boot" "$(<"$existing_result")" "persisted-install-id"
assert_equals "does not generate another ID after first boot" "$(wc -l < "$UUIDGEN_LOG" | tr -d ' ')" "1"

failed_data="$TEST_ROOT/failed-data"
failed_result="$TEST_ROOT/failed-result"
mkdir -p "$failed_data"
if run_entrypoint "$failed_data" "$failed_result" SOURCEBOT_INSTALL_ID="" UUIDGEN_SHOULD_FAIL="true"; then
  echo "FAIL: entrypoint succeeded when install ID generation failed"
  exit 1
fi
if [[ -e "$failed_data/.installedv3" ]]; then
  echo "FAIL: entrypoint left an invalid first-run file after install ID generation failed"
  exit 1
fi

echo "Entrypoint install ID tests passed."
