// scripts/deploy-plp.mjs
// Workaround for Supabase CLI 2.107.0 Windows bug where it tries to read
// file content as filename during deploy. We build the bundle locally
// with esbuild and POST it directly to the deploy API as a tarball of
// the function source files (which the server-side bundles, similar to
// --use-api mode).
//
// API: POST /v1/projects/{ref}/functions/deploy?slug=publish-landing-page
// Body: multipart/form-data with field "file" containing a tarball of the
//       function directory contents (NOT a pre-built bundle).
//
// NOTE: I tried sending a pre-built esm.js bundle first — got
// "Entrypoint path does not exist - /tmp/user_fn_.../source/". So the
// server-side bundle path is the right one: send .ts source, server
// bundles.

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!PROJECT_REF || !ACCESS_TOKEN) {
    console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN env var.');
    process.exit(1);
}

const fnDir = 'supabase/functions/publish-landing-page';
console.log(`Source dir: ${fnDir}`);

// Build a tar.gz of the function directory contents using the system `tar`
// utility (Git Bash on Windows has it). The tarball layout expected by the
// server is: a top-level directory named after the function slug containing
// the source files (per the error path `/tmp/user_fn_.../source/` from the
// earlier attempt — the API extracts the tarball into that `source/` dir).
// Resolve a tmp path that both Git Bash `tar` AND Node's `fs` agree on.
// On Windows, process.env.TEMP (e.g. C:\Users\<u>\AppData\Local\Temp) is the
// same directory Git Bash exposes as /tmp. Using it directly avoids the
// C:\tmp translation mismatch Node's fs does when given a POSIX-looking path.
// On Windows Git Bash, `tar` is a GNU userland tool that does NOT understand
// Windows-style backslash paths with drive letters when invoked through
// Node's spawn (it receives the literal arg string, not a shell-interpreted
// command). Pass the tar invocation as a single shell string via `bash -c`
// so Git Bash translates /tmp → the real Windows temp dir before tar sees it.
const tarPath = process.platform === 'win32'
    ? '/tmp/publish-landing-page.tar.gz'
    : join(process.env.TEMP || tmpdir(), 'publish-landing-page.tar.gz');

// Forward-slash version of fnDir for the shell command.
// The Supabase deploy API extracts the tarball directly into
// `source/` (per error path `/tmp/user_fn_<ref>_<id>/source/index.ts`),
// so the tarball's top-level entries must be the function's own files
// (index.ts, templating.ts, bundled-assets.ts) — NO `publish-landing-page/`
// prefix or the server can't find the entrypoint.
const fnDirPosix = fnDir.replace(/\\/g, '/');
const tarCmd = `tar -czf "${tarPath}" -C "${fnDirPosix}" .`;
const tarResult = process.platform === 'win32'
    ? spawnSync('bash', ['-c', tarCmd], { stdio: 'inherit' })
    : spawnSync('tar', ['-czf', tarPath, '-C', fnDir, '.'], { stdio: 'inherit' });
if (tarResult.status !== 0) {
    console.error('tar failed');
    process.exit(1);
}

// Read back via the Windows-resolved path so Node's fs can find it.
const tarReadPath = process.platform === 'win32'
    ? join(process.env.TEMP || tmpdir(), 'publish-landing-page.tar.gz')
    : tarPath;

const tarSize = statSync(tarReadPath).size;
console.log(`Tarball: ${tarReadPath} (${tarSize} bytes)`);
const tarBytes = readFileSync(tarReadPath);

const boundary = '----SupabaseDeploy' + Math.random().toString(36).slice(2);
const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="publish-landing-page.tar.gz"\r\n` +
    `Content-Type: application/gzip\r\n\r\n`,
    'utf8'
);
const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
const body = Buffer.concat([head, tarBytes, tail]);

const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=publish-landing-page`;
console.log(`POST ${url}`);

const res = await fetch(url, {
    method: 'POST',
    headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
    },
    body,
});
const text = await res.text();
console.log(`Response: ${res.status}`);
console.log(text.slice(0, 2000));
if (!res.ok) process.exit(1);