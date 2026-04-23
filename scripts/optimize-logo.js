import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resize logo to proper display dimensions
async function optimizeLogo() {
  const inputPath = join(__dirname, '..', 'public', 'Soctiv Logo.webp');
  const outputPath = join(__dirname, '..', 'public', 'Soctiv Logo-80.webp');
  
  await sharp(inputPath)
    .resize(80, 80, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85, effort: 6 })
    .toFile(outputPath);
    
  console.log('✅ Logo optimized successfully');
}

optimizeLogo().catch(console.error);