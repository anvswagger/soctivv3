# Git History Purge (P0.1f)

> **Audience:** the operator who is ready to rewrite git history to remove `api_keys.json` and `.env`.
> **Risk:** rewriting history breaks every open PR and every local clone.
> **Time required:** ~20 min (plus team coordination time).

---

## ⚠️ Read this first

This is a **destructive, irreversible** operation. It rewrites every commit hash in the repository's history. Anyone with a clone or an open PR must re-clone or rebase.

**Do not run this on a shared branch without coordination.** It is the operator's responsibility to:

1. Tell every contributor to push/stash their work and stop committing.
2. Close (or convert to draft) every open PR.
3. Verify the latest commit on `main` is the rotation PR (so the secrets are already out of the working tree before we purge).
4. Coordinate the force-push window.

---

## Step 1 — Confirm the working tree is clean of secrets (1 min)

```bash
git status
git ls-files | grep -E '^(api_keys\.json|\.env|api-keys\.json|keys\.json|secrets\.json)$' && echo "❌ secrets still tracked" || echo "✅ no secrets tracked"
```

If any of those files are still tracked, run:

```bash
git rm --cached api_keys.json .env
git commit -m "chore(security): untrack api_keys.json and .env (P0.1)"
```

Confirm `.gitignore` lists them (`grep -E '^(api_keys\.json|\.env)$' .gitignore` should produce output).

---

## Step 2 — Back up the repo (30 sec)

```bash
# Full mirror, including all refs, tags, and unreachable objects.
git clone --mirror git@github.com:YOUR_ORG/soctivv3.git /tmp/soctivv3-backup-$(date +%Y%m%d-%H%M%S)
```

This is your safety net. If the rewrite goes wrong, you can restore.

---

## Step 3 — Install `git filter-repo` (1 min)

`git filter-repo` is the modern, fast alternative to `git filter-branch` and BFG. Install it:

```bash
# macOS
brew install git-filter-repo

# Linux (apt)
apt install git-filter-repo

# Linux (pip)
pip install git-filter-repo

# Windows (pip in WSL or Python)
pip install git-filter-repo
```

Verify:

```bash
git filter-repo --version
```

---

## Step 4 — Run the purge (5 min)

From the working clone (not the mirror):

```bash
cd /path/to/soctivv3

# Make a list of files to remove from history.
cat > /tmp/soctiv-paths.txt <<'EOF'
api_keys.json
api-keys.json
.env
.env.local
.env.production
.env.staging
EOF

# Run the filter. This rewrites every commit that touched the listed paths.
git filter-repo --invert-paths --path-file /tmp/soctiv-paths.txt
```

> **Note:** `git filter-repo` removes the default remote and rewrites all branch refs in place. It is intentionally aggressive.

If `git filter-repo` complains about an existing `origin`:

```bash
git remote remove origin
git remote add origin git@github.com:YOUR_ORG/soctivv3.git
```

---

## Step 5 — Also purge a known secret *string* (optional, 2 min)

If you want to be extra-defensive, you can rewrite a specific token (e.g. the leaked `admin123` bcrypt hash) out of all blobs. Be careful: this is risky if the string appears in tests, fixtures, or lockfiles.

```bash
cat > /tmp/soctiv-replace.txt <<'EOF'
REDACTED_ADMIN123_HASH==>REDACTED_OLD_ADMIN_HASH
EOF

git filter-repo --replace-text /tmp/soctiv-replace.txt
```

Only do this if the leaked string is unique and not load-bearing.

---

## Step 6 — Force-push (1 min — and the dangerous one)

```bash
git push --force --all
git push --force --tags
```

> **Before this command:** make absolutely sure every contributor has been notified. Once pushed, anyone with a stale clone will need to re-clone.

If you have protected branches, the push will be rejected. Temporarily allow force-push on `main` for this operation, then re-enable protection.

---

## Step 7 — Ask everyone to re-clone (0 min — they're watching)

Post in `#ops`:

> The git history has been rewritten to remove `api_keys.json` and `.env`. Please re-clone the repo: `git clone git@github.com:YOUR_ORG/soctivv3.git`. Old hashes are gone. Open PRs must be re-opened from the new main.

---

## Step 8 — Verify (1 min)

From a fresh clone:

```bash
git clone git@github.com:YOUR_ORG/soctivv3.git /tmp/soctiv-verify
cd /tmp/soctiv-verify
git log --all --full-history -- api_keys.json .env
# expected: empty

git log --all --diff-filter=D --name-only -- 'api_keys.json' '.env*'
# expected: empty

# Search every blob for the leaked JWT prefix
git rev-list --all | xargs -I{} git ls-tree -r {} | grep -E 'eyJ[A-Za-z0-9_-]{50,}\.eyJ' || echo "✅ no leaked JWT in history"
```

---

## Step 9 — Clean up backups (30 sec)

Once the team has confirmed the new history is fine, delete the mirror:

```bash
rm -rf /tmp/soctivv3-backup-*  /tmp/soctiv-verify
```

Keep the 1Password entry for the rotated values, of course.

---

## Done

- [ ] Working tree clean of secrets
- [ ] Full mirror backed up
- [ ] `git filter-repo` installed
- [ ] `api_keys.json`, `.env`, etc. purged from history
- [ ] Force-pushed to origin
- [ ] Team notified to re-clone
- [ ] Fresh-clone verification passes
- [ ] Backups deleted
