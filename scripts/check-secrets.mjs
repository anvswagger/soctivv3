#!/usr/bin/env node
// ============================================================================
// scripts/check-secrets.mjs
// ----------------------------------------------------------------------------
// Cross-platform (Windows-friendly) port of scripts/check-secrets.sh.
// Detects common secret patterns in staged git changes and blocks the commit.
//
// Run:    node scripts/check-secrets.mjs
// Hooks:  .husky/pre-commit calls this when bash is not available.
// Exit:   0 = clean, 1 = secrets found.
// ============================================================================

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FORBIDDEN_FILES = [
  'api_keys.json',
  'api-keys.json',
  'keys.json',
  'secrets.json',
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
];

const PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, 'Supabase JWT'],
  [/sb_secret_[A-Za-z0-9_-]{20,}/g, 'Supabase sb_secret_* key'],
  [/sb_publishable_[A-Za-z0-9_-]{20,}/g, 'Supabase sb_publishable_* key'],
  [/GOCSPX-[A-Za-z0-9_-]{20,}/g, 'Google OAuth client secret'],
  [/AIza[0-9A-Za-z_-]{35}/g, 'Google API key'],
  [/AKIA[0-9A-Z]{16}/g, 'AWS access key ID'],
  [/gh[pousr]_[A-Za-z0-9]{36,}/g, 'GitHub personal access token'],
  [/sk_live_[0-9a-zA-Z]{24,}/g, 'Stripe live secret key'],
  [/pk_live_[0-9a-zA-Z]{24,}/g, 'Stripe live publishable key'],
  [/rk_live_[0-9a-zA-Z]{24,}/g, 'Stripe live restricted key'],
  [/sk-[A-Za-z0-9]{20,}/g, 'OpenAI project key'],
  [/sk-ant-[A-Za-z0-9_-]{20,}/g, 'Anthropic API key'],
  [/sk-or-v1-[A-Za-z0-9]{20,}/g, 'OpenRouter API key'],
  [/AC[0-9a-fA-F]{32}/g, 'Twilio Account SID'],
  [/SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g, 'SendGrid API key'],
  [/xox[baprs]-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]{24,}/g, 'Slack token'],
];

const SKIP_PATH_RE =
  /\.(lock|lockb|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|eot|wasm|pdf|zip|tar|gz|mp4|mp3|webm|ogg|wav)$|node_modules|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|^\.husky\/|^\.git\//;

let violations = 0;

// 1. Resolve repo root.
let repoRoot;
try {
  repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
} catch {
  console.error('❌ Not a git repository.');
  process.exit(2);
}
process.chdir(repoRoot);

// 2. Forbidden files check.
const staged = execSync('git diff --cached --name-only --diff-filter=AM', { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

for (const f of FORBIDDEN_FILES) {
  if (staged.includes(f)) {
    console.log(`❌ BLOCKED: '${f}' is in your staged changes.`);
    console.log(`   This file should never be committed.`);
    console.log(`   Fix:  git restore --staged '${f}'`);
    violations += 1;
  }
}

// 3. Pattern scan.
for (const f of staged) {
  if (SKIP_PATH_RE.test(f)) continue;
  if (f === 'scripts/check-secrets.mjs' || f === 'scripts/check-secrets.sh') continue;
  if (f === '.env.example' || f === '.gitleaks.toml') continue;

  let content = '';
  // Try to get the staged blob (the version the user is about to commit).
  try {
    content = execSync(`git show ":${f}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    if (existsSync(f)) {
      try {
        content = readFileSync(f, 'utf8');
      } catch {
        continue;
      }
    }
  }
  if (!content) continue;
  if (content.length > 512 * 1024) continue;

  for (const [re, label] of PATTERNS) {
    re.lastIndex = 0;
    const hits = content.match(re);
    if (hits) {
      console.log(`❌ BLOCKED: possible ${label} in '${f}':`);
      const lines = content.split('\n');
      const seen = new Set();
      for (const hit of hits.slice(0, 3)) {
        for (let i = 0; i < lines.length; i += 1) {
          if (lines[i].includes(hit) && !seen.has(i)) {
            seen.add(i);
            console.log(`   line ${i + 1}: ${lines[i].trim().slice(0, 100)}`);
            break;
          }
        }
      }
      violations += 1;
    }
  }
}

if (violations > 0) {
  console.log('');
  console.log(`🔒 ${violations} secret-related violation(s) found.`);
  console.log('   To bypass (NOT recommended):  git commit --no-verify');
  process.exit(1);
}

console.log('✅ No secrets detected in staged changes.');
process.exit(0);
