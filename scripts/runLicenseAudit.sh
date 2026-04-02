#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "=== License Audit ==="
echo ""

# Step 1: Fetch licenses
echo "1. Fetching licenses from npm registry..."
node scripts/fetchLicenses.mjs
echo ""

# Step 2: Summarize licenses
echo "2. Summarizing licenses..."
node scripts/summarizeLicenses.mjs
echo ""

# Step 3: Run Claude audit
echo "3. Running Claude license audit..."
if ! command -v claude &> /dev/null; then
    echo "Error: 'claude' CLI is not installed. Install it with: npm install -g @anthropic-ai/claude-code"
    exit 1
fi

PROMPT_FILE="$SCRIPT_DIR/licenseAuditPrompt.txt"
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: Prompt file not found at $PROMPT_FILE"
    exit 1
fi

claude --dangerously-skip-permissions -p "$(cat "$PROMPT_FILE")" \
    --allowedTools "Bash,Read,Write,Glob,Grep,WebFetch"
echo ""

# Step 4: Validate result
echo "4. Validating audit result..."
if [ ! -f license-audit-result.json ]; then
    echo "Error: license-audit-result.json was not created by the audit step"
    exit 1
fi

STATUS=$(node -e "const r = require('./license-audit-result.json'); console.log(r.status)")
UNRESOLVED=$(node -e "const r = require('./license-audit-result.json'); console.log(r.summary.unresolvedCount)")
STRONG=$(node -e "const r = require('./license-audit-result.json'); console.log(r.summary.strongCopyleftCount)")
WEAK=$(node -e "const r = require('./license-audit-result.json'); console.log(r.summary.weakCopyleftCount)")
RESOLVED=$(node -e "const r = require('./license-audit-result.json'); console.log(r.summary.resolvedCount)")

echo ""
echo "== License Audit Result: $STATUS =="
echo ""
echo "  Resolved:        $RESOLVED"
echo "  Unresolved:      $UNRESOLVED"
echo "  Strong copyleft: $STRONG"
echo "  Weak copyleft:   $WEAK"

if [ "$STATUS" = "FAIL" ]; then
    echo ""
    echo "FAIL reasons:"
    node -e "const r = require('./license-audit-result.json'); r.failReasons.forEach(r => console.log('  - ' + r))"
    exit 1
fi

echo ""
echo "License audit passed."
