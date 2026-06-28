import { join } from 'node:path';
const URL = 'file:///' + join(process.cwd(), 'dist', 'soctiv-preview', 'preview.html').replace(/\\/g, '/');
console.log(URL);