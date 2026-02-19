import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const jsDir = path.join(distDir, 'assets', 'js');
const manifestPath = path.join(distDir, '.vite', 'manifest.json');
const indexHtmlPath = path.join(distDir, 'index.html');

const KB = 1024;
const budget = {
  maxEntryKb: Number(process.env.BUNDLE_MAX_ENTRY_KB ?? 350),
  maxMainRouteKb: Number(process.env.BUNDLE_MAX_MAIN_ROUTE_KB ?? process.env.BUNDLE_MAX_ENTRY_KB ?? 350),
  maxChunkKb: Number(process.env.BUNDLE_MAX_CHUNK_KB ?? 700),
  maxTotalJsKb: Number(process.env.BUNDLE_MAX_TOTAL_JS_KB ?? 2800),
};

function toKb(bytes) {
  return Number((bytes / KB).toFixed(2));
}

function isValidBudget(value) {
  return Number.isFinite(value) && value > 0;
}

for (const [name, value] of Object.entries(budget)) {
  if (!isValidBudget(value)) {
    console.error(`Invalid bundle budget ${name}: ${value}`);
    process.exit(1);
  }
}

function parseRouteChunkLimits(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return [];
  }

  return rawValue
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, limit] = part.split('=').map((item) => item?.trim());
      const parsedLimit = Number(limit);

      if (!name || !isValidBudget(parsedLimit)) {
        console.error(`Invalid BUNDLE_ROUTE_CHUNK_LIMITS segment: "${part}"`);
        process.exit(1);
      }

      return { name, limit: parsedLimit };
    });
}

const routeChunkLimits = parseRouteChunkLimits(process.env.BUNDLE_ROUTE_CHUNK_LIMITS);

const jsFiles = (await readdir(jsDir)).filter((name) => name.endsWith('.js'));
const chunkSizes = await Promise.all(
  jsFiles.map(async (fileName) => {
    const fullPath = path.join(jsDir, fileName);
    const info = await stat(fullPath);
    return { fileName, bytes: info.size, kb: toKb(info.size) };
  }),
);

const totalJsBytes = chunkSizes.reduce((sum, item) => sum + item.bytes, 0);
const totalJsKb = toKb(totalJsBytes);

let entryChunkNames = new Set();
try {
  const rawManifest = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(rawManifest);
  entryChunkNames = new Set(
    Object.values(manifest)
      .filter((value) => value && typeof value === 'object' && value.isEntry && typeof value.file === 'string')
      .map((value) => path.basename(value.file))
      .filter((fileName) => fileName.endsWith('.js')),
  );
} catch (error) {
  if (error && error.code !== 'ENOENT') {
    console.error(`Failed to parse manifest at ${manifestPath}`);
    console.error(error);
    process.exit(1);
  }

  const indexHtml = await readFile(indexHtmlPath, 'utf8');
  const entryMatches = Array.from(indexHtml.matchAll(/src="\/assets\/js\/([^"]+\.js)"/g));
  entryChunkNames = new Set(entryMatches.map((match) => match[1]));
}

const chunksByName = new Map(chunkSizes.map((chunk) => [chunk.fileName, chunk]));
const entryChunks = Array.from(entryChunkNames)
  .map((name) => chunksByName.get(name))
  .filter(Boolean);
const mainEntryChunk = entryChunks.find((chunk) => chunk.fileName.startsWith('index-')) ?? entryChunks[0];

const violations = [];

for (const chunk of chunkSizes) {
  if (chunk.kb > budget.maxChunkKb) {
    violations.push(`Chunk ${chunk.fileName} is ${chunk.kb}KB (limit ${budget.maxChunkKb}KB)`);
  }
}

for (const chunk of entryChunks) {
  if (chunk.kb > budget.maxEntryKb) {
    violations.push(`Entry ${chunk.fileName} is ${chunk.kb}KB (limit ${budget.maxEntryKb}KB)`);
  }
}

if (mainEntryChunk && mainEntryChunk.kb > budget.maxMainRouteKb) {
  violations.push(`Main route entry ${mainEntryChunk.fileName} is ${mainEntryChunk.kb}KB (limit ${budget.maxMainRouteKb}KB)`);
}

for (const routeBudget of routeChunkLimits) {
  const routeChunk = chunkSizes.find((chunk) => chunk.fileName.includes(`${routeBudget.name}-`));
  if (!routeChunk) {
    violations.push(`Route chunk "${routeBudget.name}" not found in dist/assets/js`);
    continue;
  }

  if (routeChunk.kb > routeBudget.limit) {
    violations.push(`Route chunk ${routeChunk.fileName} is ${routeChunk.kb}KB (limit ${routeBudget.limit}KB)`);
  }
}

if (totalJsKb > budget.maxTotalJsKb) {
  violations.push(`Total JS is ${totalJsKb}KB (limit ${budget.maxTotalJsKb}KB)`);
}

const topChunks = [...chunkSizes]
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 8)
  .map((item) => `${item.fileName}: ${item.kb}KB`);

console.log('Bundle budget summary');
console.log(`- Entry chunk limit: ${budget.maxEntryKb}KB`);
console.log(`- Main route limit: ${budget.maxMainRouteKb}KB`);
console.log(`- Any chunk limit: ${budget.maxChunkKb}KB`);
console.log(`- Total JS limit: ${budget.maxTotalJsKb}KB`);
console.log(`- Total JS actual: ${totalJsKb}KB`);
if (mainEntryChunk) {
  console.log(`- Main route actual: ${mainEntryChunk.fileName} (${mainEntryChunk.kb}KB)`);
}
if (routeChunkLimits.length > 0) {
  console.log(`- Route chunk budgets: ${routeChunkLimits.map((item) => `${item.name}<=${item.limit}KB`).join(', ')}`);
}
console.log('- Largest chunks:');
topChunks.forEach((line) => console.log(`  ${line}`));

if (violations.length > 0) {
  console.error('\nBundle budget violations:');
  violations.forEach((line) => console.error(`- ${line}`));
  process.exit(1);
}

console.log('\nBundle budgets are within limits.');
