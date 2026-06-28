// scripts/find-script-ref.mjs
// Parse the bundle as JS code and find any reference to a bare `script`
// identifier (not a property access like obj.script, not a string, not a comment).
import { readFileSync } from 'node:fs';
import { Parser } from 'acorn';

const text = readFileSync('C:/Users/imanv/AppData/Local/Temp/publish-landing-page.esm.js', 'utf8');

// Strip import statements (esbuild may have inlined them or kept them; we
// need to walk the AST so this is only a fallback if parser can't handle them).
// Actually acorn handles ESM with `sourceType: 'module'`.

let ast;
try {
    ast = Parser.parse(text, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
    });
} catch (e) {
    console.log('Parse error:', e.message);
    process.exit(1);
}

// Walk the AST and collect Identifier nodes with name === 'script'
// that are not part of a MemberExpression.
const ids = [];
function walk(node, parent) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Identifier' && node.name === 'script') {
        // Skip if parent is MemberExpression and this is the property
        if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) {
            return;
        }
        // Skip if parent is Property and this is the key (non-computed)
        if (parent?.type === 'Property' && parent.key === node && !parent.computed) {
            return;
        }
        // Skip if it's a function/variable declaration name
        if (parent?.type === 'VariableDeclarator' && parent.id === node) return;
        if (parent?.type === 'FunctionDeclaration' && parent.id === node) return;
        if (parent?.type === 'FunctionExpression' && parent.params?.includes(node)) return;
        if (parent?.type === 'ArrowFunctionExpression' && parent.params?.includes(node)) return;
        if (parent?.type === 'ImportSpecifier' && parent.imported === node) return;
        if (parent?.type === 'ExportSpecifier' && parent.exported === node) return;
        ids.push({ name: node.name, loc: node.loc, parentType: parent?.type });
    }
    for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
        const val = node[key];
        if (Array.isArray(val)) {
            val.forEach((v) => walk(v, node));
        } else if (val && typeof val === 'object' && typeof val.type === 'string') {
            walk(val, node);
        }
    }
}

walk(ast, null);
console.log('Bare "script" references:', ids.length);
ids.forEach((id) => {
    const line = id.loc?.start?.line;
    const col = id.loc?.start?.column;
    console.log(`  parent=${id.parentType} at ${line}:${col}`);
    if (typeof line === 'number' && typeof col === 'number') {
        const lines = text.split('\n');
        const ln = lines[line - 1] ?? '';
        console.log(`    code: ${ln.slice(Math.max(0, col - 60), col + 60)}`);
    }
});