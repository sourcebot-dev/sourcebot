#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repository_root=$(cd "$script_dir/../.." && pwd)
update_script="$script_dir/updateZoektSubmodule.sh"
changelog_script="$script_dir/addZoektSyncChangelogEntry.sh"
workflow="$repository_root/.github/workflows/syncZoekt.yml"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local file=$1
  local expected=$2
  local description=$3

  if ! grep -Fq -- "$expected" "$file"; then
    fail "$description"
  fi
}

assert_equals() {
  local actual=$1
  local expected=$2
  local description=$3

  if [[ "$actual" != "$expected" ]]; then
    fail "$description (expected $expected, got $actual)"
  fi
}

test_root=$(mktemp -d)
trap 'rm -rf "$test_root"' EXIT

zoekt_remote="$test_root/zoekt.git"
zoekt_upstream="$test_root/zoekt-upstream"
sourcebot_test="$test_root/sourcebot"

git init --quiet --bare --initial-branch=main "$zoekt_remote"
git init --quiet --initial-branch=main "$zoekt_upstream"
git -C "$zoekt_upstream" config user.name "Zoekt Sync Test"
git -C "$zoekt_upstream" config user.email "zoekt-sync-test@example.com"
git -C "$zoekt_upstream" remote add origin "$zoekt_remote"

printf '%s\n' first > "$zoekt_upstream/version.txt"
git -C "$zoekt_upstream" add version.txt
git -C "$zoekt_upstream" commit --quiet -m "first"
first_sha=$(git -C "$zoekt_upstream" rev-parse HEAD)
git -C "$zoekt_upstream" push --quiet --set-upstream origin main

printf '%s\n' second > "$zoekt_upstream/version.txt"
git -C "$zoekt_upstream" commit --quiet -am "second"
second_sha=$(git -C "$zoekt_upstream" rev-parse HEAD)
git -C "$zoekt_upstream" push --quiet origin main

git init --quiet --initial-branch=main "$sourcebot_test"
git -C "$sourcebot_test" config user.name "Zoekt Sync Test"
git -C "$sourcebot_test" config user.email "zoekt-sync-test@example.com"
git -C "$sourcebot_test" -c protocol.file.allow=always \
  submodule add --quiet "$zoekt_remote" vendor/zoekt
git -C "$sourcebot_test/vendor/zoekt" checkout --quiet --detach "$first_sha"
git -C "$sourcebot_test" add vendor/zoekt
git -C "$sourcebot_test" commit --quiet -m "pin first Zoekt commit"

(
  cd "$sourcebot_test"
  "$update_script" "$second_sha"
)
staged_sha=$(git -C "$sourcebot_test" rev-parse :vendor/zoekt)
assert_equals "$staged_sha" "$second_sha" \
  "the updater should stage the requested main-branch commit"
git -C "$sourcebot_test" commit --quiet -m "advance Zoekt"

(
  cd "$sourcebot_test"
  "$update_script" "$first_sha"
)
current_sha=$(git -C "$sourcebot_test" rev-parse HEAD:vendor/zoekt)
assert_equals "$current_sha" "$second_sha" \
  "a stale event must not downgrade the Zoekt gitlink"
git -C "$sourcebot_test" diff --quiet || \
  fail "a stale event should leave the worktree unchanged"
git -C "$sourcebot_test" diff --cached --quiet || \
  fail "a stale event should leave the index unchanged"

git -C "$zoekt_upstream" switch --quiet --detach "$first_sha"
git -C "$zoekt_upstream" switch --quiet -c divergent
printf '%s\n' divergent > "$zoekt_upstream/version.txt"
git -C "$zoekt_upstream" commit --quiet -am "divergent"
divergent_sha=$(git -C "$zoekt_upstream" rev-parse HEAD)
git -C "$zoekt_upstream" push --quiet origin divergent
git -C "$sourcebot_test/vendor/zoekt" fetch --quiet origin divergent

if (
  cd "$sourcebot_test"
  "$update_script" "$divergent_sha"
) 2> "$test_root/divergent-error.txt"; then
  fail "the updater should reject a commit outside origin/main"
fi
assert_contains "$test_root/divergent-error.txt" \
  "is not reachable from origin/main" \
  "the non-main error should explain the rejected target"

git -C "$sourcebot_test/vendor/zoekt" checkout --quiet --detach "$divergent_sha"
git -C "$sourcebot_test" add vendor/zoekt
git -C "$sourcebot_test" commit --quiet -m "pin divergent Zoekt commit"

if (
  cd "$sourcebot_test"
  "$update_script" "$second_sha"
) 2> "$test_root/divergent-history-error.txt"; then
  fail "the updater should reject divergent current and target commits"
fi
assert_contains "$test_root/divergent-history-error.txt" \
  "Refusing to move Zoekt between divergent histories" \
  "the divergent-history error should explain the rejected update"

if (
  cd "$sourcebot_test"
  "$update_script" deadbeef
) 2> "$test_root/invalid-error.txt"; then
  fail "the updater should reject abbreviated commit SHAs"
fi
assert_contains "$test_root/invalid-error.txt" \
  "Expected a full lowercase Zoekt commit SHA" \
  "the invalid-SHA error should explain the required format"

changelog_fixture="$test_root/CHANGELOG.md"
cat > "$changelog_fixture" <<'EOF'
# Changelog

## [Unreleased]

### Added
- Added something.

### Removed
- Removed something.

### Fixed
- Fixed something.

## [1.0.0]
EOF

chmod 640 "$changelog_fixture"
CHANGELOG_PATH="$changelog_fixture" "$changelog_script" 42
assert_contains "$changelog_fixture" \
  "### Changed" \
  "the changelog helper should create the Changed section when absent"
assert_contains "$changelog_fixture" \
  "- Updated the bundled Zoekt version. [#42](https://github.com/sourcebot-dev/sourcebot/pull/42)" \
  "the changelog helper should add the generated PR link"
CHANGELOG_PATH="$changelog_fixture" "$changelog_script" 42
entry_count=$(grep -Fc "sourcebot/pull/42" "$changelog_fixture")
assert_equals "$entry_count" 1 \
  "the changelog helper should not duplicate an existing PR entry"
if changelog_mode=$(stat -f '%Lp' "$changelog_fixture" 2> /dev/null); then
  :
else
  changelog_mode=$(stat -c '%a' "$changelog_fixture")
fi
assert_equals "$changelog_mode" 640 \
  "the changelog helper should preserve the target file mode"

empty_changelog_fixture="$test_root/EMPTY_CHANGELOG.md"
cat > "$empty_changelog_fixture" <<'EOF'
# Changelog

## [Unreleased]
EOF
CHANGELOG_PATH="$empty_changelog_fixture" "$changelog_script" 43
assert_contains "$empty_changelog_fixture" \
  "- Updated the bundled Zoekt version. [#43](https://github.com/sourcebot-dev/sourcebot/pull/43)" \
  "the changelog helper should handle an empty Unreleased section at EOF"

ruby -e 'require "yaml"; YAML.parse_file(ARGV.fetch(0))' "$workflow"
assert_contains "$workflow" \
  "types: [zoekt-pr-merged]" \
  "the receiver should handle only Zoekt merge dispatches"
assert_contains "$workflow" \
  'uses: actions/create-github-app-token@v2' \
  "the receiver should use a GitHub App token"
assert_contains "$workflow" \
  'permission-pull-requests: write' \
  "the receiver should restrict its app token to required permissions"
assert_contains "$workflow" \
  '--force-with-lease=' \
  "the receiver should protect updates to its stable automation branch"
assert_contains "$workflow" \
  '.github/scripts/updateZoektSubmodule.sh "$ZOEKT_SHA"' \
  "the receiver should validate and stage the requested Zoekt commit"

echo "All Zoekt sync tests passed."
