// Show exact text around the critical </style> that closes prematurely
import { readFileSync } from 'node:fs';

const html = readFileSync('dist/soctiv-preview/iframe-test.html', 'utf8');

console.log('=== Around pos 1620-1920 (the rogue </style> at 1895) ===');
console.log(html.substring(1620, 1920));
console.log('\n=== And the </style> at 24328 (the legitimate closing) ===');
console.log(html.substring(24250, 24400));
