#!/usr/bin/env bash

set -euo pipefail

target_sha="${1:-}"
submodule_path="${ZOEKT_SUBMODULE_PATH:-vendor/zoekt}"
remote="${ZOEKT_REMOTE:-origin}"
branch="${ZOEKT_BRANCH:-main}"

if [[ ! "$target_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Expected a full lowercase Zoekt commit SHA, got: $target_sha" >&2
  exit 1
fi

repository_root=$(git rev-parse --show-toplevel)
cd "$repository_root"

if ! current_sha=$(git rev-parse "HEAD:$submodule_path"); then
  echo "Unable to read the $submodule_path gitlink from HEAD." >&2
  exit 1
fi

git -C "$submodule_path" fetch --quiet "$remote" "$branch"
remote_head=$(git -C "$submodule_path" rev-parse FETCH_HEAD)

if ! git -C "$submodule_path" cat-file -e "$target_sha^{commit}"; then
  echo "Zoekt commit $target_sha does not exist." >&2
  exit 1
fi

if ! git -C "$submodule_path" merge-base --is-ancestor "$target_sha" "$remote_head"; then
  echo "Zoekt commit $target_sha is not reachable from $remote/$branch." >&2
  exit 1
fi

if git -C "$submodule_path" merge-base --is-ancestor "$target_sha" "$current_sha"; then
  echo "Zoekt is already at or ahead of $target_sha."
  exit 0
fi

if ! git -C "$submodule_path" merge-base --is-ancestor "$current_sha" "$target_sha"; then
  echo "Refusing to move Zoekt between divergent histories: $current_sha -> $target_sha." >&2
  exit 1
fi

git -C "$submodule_path" checkout --quiet --detach "$target_sha"
git add -- "$submodule_path"
echo "Staged Zoekt update: $current_sha -> $target_sha"
