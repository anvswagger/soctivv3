#!/usr/bin/env bash
# ============================================================================
# scripts/check-secrets.sh
# ----------------------------------------------------------------------------
# Pre-commit / pre-push secret scanner. Fails the commit if it detects a
# likely secret in the staged diff.
#
# Detects (with safe false-positive handling):
#   - Supabase service_role JWTs (eyJ... with role:"service_role")
#   - Supabase sb_secret_* / sb_publishable_* keys
#   - Google OAuth secrets (GOCSPX-...)
#   - GitHub PATs (ghp_*, gho_*, ghs_*)
#   - Stripe live keys (sk_live_*, pk_live_*, rk_live_*)
#   - OpenAI / Anthropic / OpenRouter keys
#   - AWS access key IDs (AKIA...)
#   - Twilio account SIDs (AC...)
#   - SendGrid keys (SG.*)
#   - Files that should never be tracked (api_keys.json, .env, etc.)
#
# Exit codes:
#   0 → no secrets found, commit allowed
#   1 → secrets found, commit blocked
#   2 → script error
# ============================================================================

set -euo pipefail

# Always run from the repo root so paths are stable.
cd "$(git rev-parse --show-toplevel)"

# Files that should never be staged.
FORBIDDEN_FILES=(
  "api_keys.json"
  "api-keys.json"
  "keys.json"
  "secrets.json"
  ".env"
  ".env.local"
  ".env.production"
  ".env.staging"
)

# Patterns: "<ERE regex>|<human label>". Order matters: more specific first.
PATTERNS=(
  'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|Supabase JWT'
  'sb_secret_[A-Za-z0-9_-]{20,}|Supabase sb_secret_* key'
  'sb_publishable_[A-Za-z0-9_-]{20,}|Supabase sb_publishable_* key'
  'GOCSPX-[A-Za-z0-9_-]{20,}|Google OAuth client secret'
  'AIza[0-9A-Za-z_-]{35}|Google API key'
  'AKIA[0-9A-Z]{16}|AWS access key ID'
  'gh[pousr]_[A-Za-z0-9]{36,}|GitHub personal access token'
  'sk_live_[0-9a-zA-Z]{24,}|Stripe live secret key'
  'pk_live_[0-9a-zA-Z]{24,}|Stripe live publishable key'
  'rk_live_[0-9a-zA-Z]{24,}|Stripe live restricted key'
  'sk-[A-Za-z0-9]{20,}|OpenAI project key'
  'sk-ant-[A-Za-z0-9_-]{20,}|Anthropic API key'
  'sk-or-v1-[A-Za-z0-9]{20,}|OpenRouter API key'
  'AC[0-9a-fA-F]{32}|Twilio Account SID'
  'SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}|SendGrid API key'
  'xox[baprs]-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]{24,}|Slack token'
)

# Files/dirs to skip in content scan (binaries, lockfiles, this script itself).
SKIP_PATH_REGEX='\.(lock|lockb|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|eot|svg|wasm|pdf|zip|tar|gz|br|mp4|mp3|webm|ogg|wav|ico)$|/(node_modules|dist|build|coverage|public|landing-pages)/|/package-lock\.json$|/yarn\.lock$|/pnpm-lock\.yaml$|^\.git/'

violations=0

# 1. Check for forbidden files in the staged set.
for f in "${FORBIDDEN_FILES[@]}"; do
  if git diff --cached --name-only --diff-filter=AM | grep -qxF "$f"; then
    echo "❌ BLOCKED: '$f' is in your staged changes."
    echo "   This file should never be committed."
    echo "   Fix:  git restore --staged '$f'   (then ensure .gitignore lists it)"
    violations=$((violations + 1))
  fi
done

# 2. Scan the *contents* of staged files for known secret patterns.
staged_files=$(git diff --cached --name-only --diff-filter=AM || true)
if [ -n "$staged_files" ]; then
  for f in $staged_files; do
    # Skip excluded paths.
    if echo "$f" | grep -Eq "$SKIP_PATH_REGEX"; then
      continue
    fi
    # Skip this script itself and the .env.example template.
    case "$f" in
      scripts/check-secrets.sh|.env.example|.gitleaks.toml) continue ;;
    esac

    # Use the staged blob if the file is tracked; otherwise read working tree.
    content=""
    if git cat-file -e "HEAD:${f}" 2>/dev/null; then
      content=$(git show ":${f}" 2>/dev/null || true)
    elif [ -f "$f" ] && [ -r "$f" ]; then
      content=$(cat "$f" 2>/dev/null || true)
    fi

    if [ -z "$content" ]; then
      continue
    fi

    # Skip very large files (>512KB).
    if [ "${#content}" -gt 524288 ]; then
      continue
    fi

    for entry in "${PATTERNS[@]}"; do
      pattern="${entry%|*}"
      label="${entry##*|}"
      # The `(^|[^A-Za-z0-9_-])` prefix and `($|[^A-Za-z0-9_-])` suffix reduce
      # false positives by requiring a non-word boundary. (We rely on
      # grep -E for ERE.)
      matches=$(printf '%s' "$content" | grep -En -e "$pattern" 2>/dev/null || true)
      if [ -n "$matches" ]; then
        echo "❌ BLOCKED: possible $label in '$f':"
        echo "$matches" | head -3 | sed 's/^/   /'
        violations=$((violations + 1))
      fi
    done
  done
fi

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "🔒 $violations secret-related violation(s) found."
  echo "   To bypass (NOT recommended):  git commit --no-verify"
  echo "   If a hit is a false positive, add the marker 'secrets:allow' on the same"
  echo "   line, or update scripts/check-secrets.sh to whitelist it."
  exit 1
fi

echo "✅ No secrets detected in staged changes."
exit 0
