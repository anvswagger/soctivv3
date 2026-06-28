// Check files imported via `?raw` for characters that would break a JS template literal
import { readFileSync } from 'node:fs';

const files = [
    'supabase/functions/publish-landing-page/styles.css',
    'supabase/functions/publish-landing-page/client_runtime.js',
    'supabase/functions/publish-landing-page/template_index.html',
    'supabase/functions/publish-landing-page/assets/pixel.js',
    'supabase/functions/publish-landing-page/assets/sha256.js',
];

for (const f of files) {
    const c = readFileSync(f, 'utf8');
    // Escape sequences that matter in JS template literals
    const interp = (c.match(/\$\{/g) || []).length;
    const backticks = (c.match(/`/g) || []).length;
    console.log(f);
    console.log('  unescaped ${ count:', interp);
    console.log('  backticks:', backticks);
}
