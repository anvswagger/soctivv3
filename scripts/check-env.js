import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envTemplate = '.env.example';
const envLocal = '.env';
const requiredRuntimeKeys = ['VITE_SUPABASE_URL'];
const requiredClientKeys = ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'];

const parseKeys = (contents) =>
  contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('=')[0]?.trim())
    .filter(Boolean);

const parseEnvMap = (contents) => {
  const envMap = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    const rawValue = line.slice(separatorIndex + 1).trim();
    const unquotedValue =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    envMap[key] = unquotedValue;
  }
  return envMap;
};

const templatePath = path.join(root, envTemplate);

if (!fs.existsSync(templatePath)) {
  console.error(`ERROR Missing env template: ${envTemplate}`);
  console.log('Please create .env.example with all required environment variables.');
  process.exit(1);
}

const templateKeys = new Set(parseKeys(fs.readFileSync(templatePath, 'utf8')));
console.log(`OK Found ${envTemplate} with ${templateKeys.size} variables`);

const envPath = path.join(root, envLocal);
const envFileMap = fs.existsSync(envPath) ? parseEnvMap(fs.readFileSync(envPath, 'utf8')) : {};
if (fs.existsSync(envPath)) {
  const envKeys = new Set(parseKeys(fs.readFileSync(envPath, 'utf8')));
  const missing = [...templateKeys].filter((key) => !envKeys.has(key));

  if (missing.length > 0) {
    console.warn(`WARN Missing keys in ${envLocal}: ${missing.join(', ')}`);
  } else {
    console.log(`OK ${envLocal} contains all required keys`);
  }
} else {
  console.warn(`WARN ${envLocal} does not exist - copy ${envTemplate} and fill in values`);
}

const isCiLike = process.env.CI === 'true' || Boolean(process.env.NETLIFY);
const skipEnvCheck = process.env.SKIP_ENV_CHECK === 'true';

if (isCiLike && !skipEnvCheck) {
  const resolveEnv = (key) => process.env[key] || envFileMap[key];
  const missingRuntime = requiredRuntimeKeys.filter((key) => !resolveEnv(key));
  const hasClientKey = requiredClientKeys.some((key) => Boolean(resolveEnv(key)));
  const hasUnprefixedSupabaseVars = Boolean(resolveEnv('SUPABASE_URL') || resolveEnv('SUPABASE_ANON_KEY'));

  if (missingRuntime.length > 0 || !hasClientKey) {
    console.error('ERROR Missing required runtime env vars for production build.');
    if (missingRuntime.length > 0) {
      console.error(`Missing: ${missingRuntime.join(', ')}`);
    }
    if (!hasClientKey) {
      console.error('Missing: VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY)');
    }
    if (hasUnprefixedSupabaseVars) {
      console.error('Found SUPABASE_* vars, but Vite only exposes env vars prefixed with VITE_.');
    }
    if (process.env.NETLIFY) {
      console.error('Netlify fix: Site settings -> Build & deploy -> Environment variables');
      console.error('Add: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)');
      console.error('To skip this check for preview builds: set SKIP_ENV_CHECK=true in environment variables');
    }
    process.exit(1);
  }

  if (Object.keys(envFileMap).length > 0 && process.env.NETLIFY) {
    console.warn('WARN Using .env fallback values in CI. Prefer setting these in Netlify environment variables.');
  }
} else if (skipEnvCheck) {
  console.warn('⚠️  SKIP_ENV_CHECK is enabled - skipping environment variable validation');
  console.warn('⚠️  This is intended for preview builds only. Production builds require proper environment variables.');
}

console.log('\nDONE Environment check complete');
