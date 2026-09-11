#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_ROOT=$(mktemp -d)
trap 'rm -rf "$TEST_ROOT"' EXIT

FAKE_BIN="$TEST_ROOT/bin"
UUIDGEN_LOG="$TEST_ROOT/uuidgen.log"
mkdir -p "$FAKE_BIN"
: > "$UUIDGEN_LOG"

cat > "$FAKE_BIN/uuidgen" <<'EOF'
#!/usr/bin/env bash
printf 'called\n' >> "$UUIDGEN_LOG"
printf 'generated-install-id\n'
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

chmod +x "$FAKE_BIN/uuidgen" "$FAKE_BIN/yarn" "$FAKE_BIN/mkdir" "$FAKE_BIN/supervisord"

run_entrypoint() {
  local data_dir="$1"
  local result_file="$2"
  shift 2

  env \
    PATH="$FAKE_BIN:$PATH" \
    UUIDGEN_LOG="$UUIDGEN_LOG" \
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
mkdir -p "$supplied_data"
run_entrypoint "$supplied_data" "$supplied_result" SOURCEBOT_INSTALL_ID="supplied-install-id"
assert_equals "uses the supplied install ID on first boot" "$(<"$supplied_result")" "supplied-install-id"
assert_equals "persists the supplied install ID" "$(jq -r '.install_id' "$supplied_data/.installedv3")" "supplied-install-id"
assert_equals "does not generate an ID when one is supplied" "$(wc -l < "$UUIDGEN_LOG" | tr -d ' ')" "0"

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

echo "Entrypoint install ID tests passed."
