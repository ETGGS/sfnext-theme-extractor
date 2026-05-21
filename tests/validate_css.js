/**
 * SF Next Theme Extractor — CSS Output Validator
 *
 * Usage:   node tests/validate_css.js <scaffold.css> <output.css>
 * Example: node tests/validate_css.js public/theme-sample.css theme-puma.css
 *
 * Validates a generated theme CSS file against 23 rules derived from the
 * Salesforce Next scaffold specification. Run this against every generated
 * theme file before handing it to a developer.
 *
 * Exit code 0 = all checks pass (or only warnings)
 * Exit code 1 = one or more failures
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Args ─────────────────────────────────────────────────────────────────────
const [,, scaffoldArg, outputArg] = process.argv;

if (!scaffoldArg || !outputArg) {
  console.error('Usage: node tests/validate_css.js <scaffold.css> <output.css>');
  process.exit(1);
}

const scaffoldPath = path.resolve(scaffoldArg);
const outputPath   = path.resolve(outputArg);

if (!fs.existsSync(scaffoldPath)) { console.error('Scaffold not found:', scaffoldPath); process.exit(1); }
if (!fs.existsSync(outputPath))   { console.error('Output not found:',   outputPath);   process.exit(1); }

const scaffold = fs.readFileSync(scaffoldPath, 'utf8');
const output   = fs.readFileSync(outputPath,   'utf8');

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, warnings = 0;

function pass(msg)  { console.log('  ✅ PASS:', msg); passed++;   }
function fail(msg)  { console.log('  ❌ FAIL:', msg); failed++;   }
function warn(msg)  { console.log('  ⚠️  WARN:', msg); warnings++; }
function section(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 50 - t.length))); }

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 1 — Base @imports unchanged
// ══════════════════════════════════════════════════════════════════════════════
section('Base Imports');

const sImports = scaffold.match(/@import[^;]+;/g) || [];
const oImports = output.match(/@import[^;]+;/g)   || [];

if (sImports.length === oImports.length && sImports.every((x, i) => x === oImports[i])) {
  pass('All ' + sImports.length + ' base @import lines unchanged');
} else {
  fail('Base @import lines changed or missing');
  sImports.forEach((imp, i) => {
    if (imp !== oImports[i]) {
      console.log('     Expected:', imp);
      console.log('     Got:     ', oImports[i] || '(missing)');
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 2 — @custom-variant unchanged
// ══════════════════════════════════════════════════════════════════════════════
const cv1 = scaffold.match(/@custom-variant[^\n]+/)?.[0];
const cv2  = output.match(/@custom-variant[^\n]+/)?.[0];
cv1 === cv2
  ? pass('@custom-variant line unchanged')
  : fail('@custom-variant changed\n     Expected: ' + cv1 + '\n     Got:      ' + cv2);

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 3 — Section order
// ══════════════════════════════════════════════════════════════════════════════
section('Section Order');

const sections = [
  ['1. Base imports',    /@import 'tailwindcss'/],
  ['2. Brand comment',   /\/\*.*theme overrides/],
  ['3. @theme inline',   /@theme inline/],
  ['4. :root block',     /:root\s*\{/],
  ['5. Logo override',   /\[data-testid="header-logo"\]/],
  ['6. CTA button',      /\[data-slot="button"\]\[data-variant="default"\]/],
  ['7. Search bar',      /header-search/],
];

let lastIdx = -1;
sections.forEach(([name, re]) => {
  const m = output.search(re);
  if (m === -1) { fail('Missing section: ' + name); return; }
  if (m > lastIdx) { pass('Section in order: ' + name); lastIdx = m; }
  else               fail('Section out of order: ' + name);
});

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 4 — No bare text inside :root{} (comment-aware)
// ══════════════════════════════════════════════════════════════════════════════
section(':root Block Validity');

const rootMatch = output.match(/:root\s*\{([\s\S]*?)\n\}/);
if (rootMatch) {
  const lines    = rootMatch[1].split('\n');
  let inComment  = false;
  const bareLines = [];

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    if (t.includes('/*')) inComment = true;
    if (t.includes('*/')) { inComment = false; return; }
    if (inComment) return;
    if (t.startsWith('--') || t === '}' || t.startsWith('/*') || t.startsWith('*')) return;
    bareLines.push('Line ' + (i + 1) + ': ' + t.slice(0, 80));
  });

  bareLines.length === 0
    ? pass('No bare text inside :root{} — all lines are valid CSS or comments')
    : bareLines.forEach(b => fail('Bare non-CSS text inside :root — ' + b));
} else {
  fail(':root block not found in output');
}

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 5 — All scaffold tokens present
// ══════════════════════════════════════════════════════════════════════════════
section('Token Coverage');

const sTokens  = [...scaffold.matchAll(/--[\w-]+(?=\s*:)/g)].map(m => m[0]);
const oTokenSet = new Set([...output.matchAll(/--[\w-]+(?=\s*:)/g)].map(m => m[0]));
const missing  = sTokens.filter(t => !oTokenSet.has(t));

missing.length === 0
  ? pass('All ' + sTokens.length + ' scaffold tokens present in output')
  : missing.forEach(t => fail('Missing token: ' + t));

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 6 — No extra invented tokens
// ══════════════════════════════════════════════════════════════════════════════
const sTokenSet = new Set(sTokens);
const extras    = [...oTokenSet].filter(t => !sTokenSet.has(t));
extras.length === 0
  ? pass('No extra tokens added beyond scaffold')
  : extras.forEach(t => warn('Extra token (verify it is an intentional brand variable): ' + t));

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 7 — Hex value format validity
// ══════════════════════════════════════════════════════════════════════════════
section('Value Formats');

const hexVals = [...output.matchAll(/:\s*(#[0-9a-fA-F]+)/g)].map(m => m[1]);
const badHex  = hexVals.filter(h => ![3, 4, 6, 8].includes(h.length - 1));
badHex.length === 0
  ? pass('All ' + hexVals.length + ' hex values are valid length (3/4/6/8 digits)')
  : badHex.forEach(h => fail('Invalid hex value: ' + h));

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 8 — No obviously invented font names
// ══════════════════════════════════════════════════════════════════════════════
const fontLines = output.match(/--font-[^:]+:[^\n;]+/g) || [];
let fontIssues  = 0;
fontLines.forEach(line => {
  if (/brand\s+font\s+name/i.test(line)) { fail('Placeholder font not replaced: ' + line.trim()); fontIssues++; }
});
fontIssues === 0
  ? pass('Font declarations checked — no obvious placeholder names remain')
  : null;

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 9 — Brace balance
// ══════════════════════════════════════════════════════════════════════════════
section('Structural Integrity');

const opens  = (output.match(/\{/g) || []).length;
const closes = (output.match(/\}/g) || []).length;
opens === closes
  ? pass('Braces balanced (' + opens + ' pairs)')
  : fail('Unbalanced braces: ' + opens + ' open, ' + closes + ' close');

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 10 — Comment balance (accounting for /*.css false positives)
// ══════════════════════════════════════════════════════════════════════════════
// We check final depth rather than raw count to handle CSS-in-comment edge cases
let depth = 0, pos = 0;
while (pos < output.length) {
  if (output[pos] === '/' && output[pos + 1] === '*') { depth++;              pos += 2; }
  else if (output[pos] === '*' && output[pos + 1] === '/') { depth = Math.max(0, depth - 1); pos += 2; }
  else pos++;
}
depth === 0
  ? pass('CSS comments balanced (no unclosed /* blocks)')
  : fail('Unclosed CSS comment detected — depth at EOF: ' + depth);

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 11 — Brand header comment populated
// ══════════════════════════════════════════════════════════════════════════════
section('Brand Header Comment');

/Source:\s*https?:\/\//.test(output)
  ? pass('Brand comment has Source URL')
  : fail('Brand comment missing Source URL');

/Generated:\s*\d{4}-\d{2}-\d{2}/.test(output)
  ? pass('Brand comment has Generated date (YYYY-MM-DD)')
  : fail('Brand comment missing Generated date');

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 12 — No AI internal notes leaked as bare CSS
// ══════════════════════════════════════════════════════════════════════════════
section('AI Output Hygiene');

/^\s*source:\s*training/im.test(output)
  ? fail('AI internal note leaked as bare CSS text: "source: training-data"')
  : pass('No AI internal notes leaked as bare CSS');

// ══════════════════════════════════════════════════════════════════════════════
// CHECK 13 — Trailing newline
// ══════════════════════════════════════════════════════════════════════════════
output.endsWith('\n')
  ? pass('File ends with trailing newline')
  : warn('File missing trailing newline (minor — most tools handle this)');

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(56));
console.log('Results: ' + passed + ' passed | ' + failed + ' failed | ' + warnings + ' warnings');

if (failed === 0) {
  console.log(warnings > 0
    ? 'FILE VALID ✓ (with ' + warnings + ' warning' + (warnings > 1 ? 's' : '') + ' — review above)\n'
    : 'FILE IS VALID — ready to use ✓\n'
  );
} else {
  console.log('FILE HAS ISSUES — fix failures before using in production\n');
  process.exit(1);
}
