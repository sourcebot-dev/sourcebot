#!/usr/bin/env bash

set -euo pipefail

pr_number="${1:-}"
changelog="${CHANGELOG_PATH:-CHANGELOG.md}"

if [[ ! "$pr_number" =~ ^[1-9][0-9]*$ ]]; then
  echo "Expected a pull request number, got: $pr_number" >&2
  exit 1
fi

pr_url="https://github.com/sourcebot-dev/sourcebot/pull/$pr_number"
entry="- Updated the bundled Zoekt version. [#$pr_number]($pr_url)"

if grep -Fq "$pr_url" "$changelog"; then
  echo "Changelog already links to Sourcebot PR #$pr_number."
  exit 0
fi

temporary_file=$(mktemp)
trap 'rm -f "$temporary_file"' EXIT

awk -v entry="$entry" '
  function flush_changed_section(    last, i) {
    last = changed_line_count
    while (last > 0 && changed_lines[last] == "") {
      last--
    }
    for (i = 1; i <= last; i++) {
      print changed_lines[i]
    }
    print entry
    print ""
    changed_line_count = 0
  }

  $0 == "## [Unreleased]" {
    in_unreleased = 1
    print
    next
  }

  in_unreleased && $0 == "### Changed" {
    found_changed = 1
    in_changed = 1
    print
    next
  }

  in_changed && /^##(#)? / {
    flush_changed_section()
    in_changed = 0
    inserted = 1
    if ($0 ~ /^## /) {
      in_unreleased = 0
    }
    print
    next
  }

  in_changed {
    changed_lines[++changed_line_count] = $0
    next
  }

  in_unreleased && !found_changed && /^### (Deprecated|Removed|Fixed|Security)$/ {
    print "### Changed"
    print entry
    print ""
    found_changed = 1
    inserted = 1
    print
    next
  }

  in_unreleased && !found_changed && /^## / {
    print "### Changed"
    print entry
    print ""
    found_changed = 1
    inserted = 1
    in_unreleased = 0
    print
    next
  }

  { print }

  END {
    if (in_changed) {
      flush_changed_section()
      inserted = 1
    }
    if (!found_changed || !inserted) {
      exit 2
    }
  }
' "$changelog" > "$temporary_file" || {
  echo "Unable to add an Unreleased Changed entry to $changelog." >&2
  exit 1
}

mv "$temporary_file" "$changelog"
trap - EXIT
echo "Added the changelog entry for Sourcebot PR #$pr_number."
