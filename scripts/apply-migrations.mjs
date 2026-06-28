// scripts/apply-migrations.mjs — apply missing Supabase migrations via Management API.
// Usage: node scripts/apply-migrations.mjs
// Reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from env.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!SUPABASE_PROJECT_REF || !SUPABASE_ACCESS_TOKEN) {
    console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN env var.');
    process.exit(1);
}

const MIG_DIR = new URL('../supabase/migrations/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const all = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();

// Pull the remote migration list to find which are already applied.
const remoteRes = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/migrations`,
    { headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` } }
);
if (!remoteRes.ok) {
    console.error('Failed to fetch remote migrations:', remoteRes.status, await remoteRes.text());
    process.exit(1);
}
const remoteList = await remoteRes.json();
const remoteVersions = new Set(remoteList.map((m) => m.version));
console.log(`Remote has ${remoteVersions.size} migrations applied.`);

const missing = all
    .map((f) => ({ file: f, version: f.split('_')[0] }))
    .filter((m) => !remoteVersions.has(m.version));

if (missing.length === 0) {
    console.log('No missing migrations.');
    process.exit(0);
}

console.log(`Applying ${missing.length} missing migrations:`);
for (const m of missing) {
    const sql = readFileSync(join(MIG_DIR, m.file), 'utf8');
    console.log(`  - ${m.file} (${sql.length} bytes)`);
    const res = await fetch(
        `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: sql }),
        }
    );
    const text = await res.text();
    if (!res.ok) {
        console.error(`    FAILED ${res.status}: ${text.slice(0, 400)}`);
        process.exit(1);
    } else {
        console.log(`    ok (${res.status})`);
    }
}

console.log('All migrations applied.');
