import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envTemplate = '.env.example';
const envLocal = '.env';

const parseKeys = (contents) =>
  contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('=')[0]?.trim())
    .filter(Boolean);

const templatePath = path.join(root, envTemplate);

if (!fs.existsSync(templatePath)) {
  console.error(`ERROR Missing env template: ${envTemplate}`);
  console.log('Please create .env.example with all required environment variables.');
  process.exit(1);
}

const templateKeys = new Set(parseKeys(fs.readFileSync(templatePath, 'utf8')));
console.log(`OK Found ${envTemplate} with ${templateKeys.size} variables`);

const envPath = path.join(root, envLocal);
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

console.log('\nDONE Environment check complete');

