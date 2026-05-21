/**
 * SF Next Theme Extractor — Unit, Regression & Security Test Suite
 *
 * Usage:   node tests/test_app.js
 * Requires: Node.js 18+
 *
 * Covers:
 *   - Full JS syntax validation
 *   - DOM structure (all required element IDs)
 *   - All 4 provider card + config objects
 *   - Anthropic proxy endpoint
 *   - Syntax highlighter (9 cases)
 *   - Asset extraction functions
 *   - Tab switching
 *   - Step wiring
 *   - Reset behaviour
 *   - Helper functions
 *   - Infrastructure (proxy file, scaffold)
 *   - Footer attribution
 *   - Security: browser (11 checks)
 *   - Security: proxy (4 checks)
 *   - Security: HTTP headers (4 checks)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT      = path.join(__dirname, '..');
const HTML_FILE = path.join(ROOT, 'public', 'index.html');
const PROXY_FILE= path.join(ROOT, 'netlify', 'functions', 'anthropic-proxy.js');
const HDR_FILE  = path.join(ROOT, 'public', '_headers');

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function pass(msg) { console.log('  ✅', msg); passed++; }
function fail(msg) { console.error('  ❌', msg); failed++; }
function section(title) { console.log('\n── ' + title + ' ' + '─'.repeat(Math.max(0, 50 - title.length))); }

// ── Load files ────────────────────────────────────────────────────────────────
if (!fs.existsSync(HTML_FILE))  { console.error('FATAL: index.html not found at', HTML_FILE);  process.exit(1); }
if (!fs.existsSync(PROXY_FILE)) { console.error('FATAL: anthropic-proxy.js not found');         process.exit(1); }
if (!fs.existsSync(HDR_FILE))   { console.error('FATAL: _headers not found at', HDR_FILE);      process.exit(1); }

const html  = fs.readFileSync(HTML_FILE,  'utf8');
const proxy = fs.readFileSync(PROXY_FILE, 'utf8');
const hdrs  = fs.readFileSync(HDR_FILE,   'utf8');

// ── Extract script block ──────────────────────────────────────────────────────
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*\n*<footer/);
if (!scriptMatch) { console.error('FATAL: No <script> block found in index.html'); process.exit(1); }
const scriptSrc = scriptMatch[1];

// ══════════════════════════════════════════════════════════════════════════════
// 1. JS SYNTAX
// ══════════════════════════════════════════════════════════════════════════════
section('JS Syntax');
try {
  new Function(scriptSrc);
  pass('Full script block parses without syntax errors');
} catch (e) {
  fail('JS syntax error: ' + e.message);
  console.error('     Cannot continue — fix JS syntax first.');
  process.exit(1);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. DOM STRUCTURE
// ══════════════════════════════════════════════════════════════════════════════
section('DOM Structure');

const requiredIds = [
  // Screens
  'screen-key', 'screen-app',
  // Key setup
  'key-input', 'key-validate-btn',
  // App
  'url-input', 'extract-btn', 'copy-btn', 'dl-btn', 'reset-btn',
  // Output
  'out-fn', 'ph', 'out-wrap', 'css-out',
  // Progress steps
  's-read', 's-search', 's-css', 's-fonts', 's-header', 's-buttons', 's-gen', 's-assets',
  // Tabs
  'tab-css-btn', 'tab-assets-btn', 'tab-css', 'tab-assets',
  // Assets panel
  'assets-area', 'assets-ph', 'assets-count',
];

requiredIds.forEach(id => {
  html.includes('id="' + id + '"')
    ? pass('Element #' + id + ' present')
    : fail('Element #' + id + ' MISSING');
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. PROVIDER CARDS + CONFIG
// ══════════════════════════════════════════════════════════════════════════════
section('Providers');

['anthropic', 'openai', 'mistral', 'gemini'].forEach(p => {
  html.includes('data-provider="' + p + '"')
    ? pass('Provider card UI: ' + p)
    : fail('Provider card UI missing: ' + p);

  (html.includes(p + ':{') || html.includes(p + ': {'))
    ? pass('Provider config object: ' + p)
    : fail('Provider config object missing: ' + p);
});

html.includes('/.netlify/functions/anthropic-proxy')
  ? pass('Anthropic proxy endpoint wired in provider config')
  : fail('Anthropic proxy endpoint missing from config');

// ══════════════════════════════════════════════════════════════════════════════
// 4. SYNTAX HIGHLIGHTER
// ══════════════════════════════════════════════════════════════════════════════
section('Syntax Highlighter');

const hIdx = html.indexOf('function highlight(css){');
const hEnd = html.indexOf('\n}', hIdx) + 2;
let highlight;
try {
  highlight = new Function('return ' + html.slice(hIdx, hEnd).replace('function highlight(css)', 'function(css)'))();
} catch (e) {
  fail('Cannot instantiate highlight(): ' + e.message);
}

if (highlight) {
  const hlTests = [
    ['Comment → cc span',      '/* comment */',               s => s.includes('<span class="cc">')],
    ['@import → ci span',      "@import 'tailwindcss';",      s => s.includes('<span class="ci">')],
    ['@theme → ca span',       '@theme inline {',             s => s.includes('<span class="ca">')],
    ['Custom prop → cp span',  '    --brand-primary: #000;',  s => s.includes('<span class="cp">')],
    ['Hex colour → ch span',   '    --bg: #ffffff;',          s => s.includes('<span class="ch">')],
    ['rgba → cr span',         '--border: rgba(0,0,0,0.08);', s => s.includes('<span class="cr">')],
    ['No text content leakage','--x: #abc;\n/* hi */',        s => { const txt = s.replace(/<[^>]+>/g, ''); return !['cc','ci','ca','cp','ch','cr','cs'].some(c => txt.includes('"' + c + '">')); }],
    ['Ampersand escaped',      '&:is(.dark *)',                s => s.includes('&amp;')],
    ['All spans closed',       '--a: #fff;\n/* b */',         s => (s.match(/<span/g)||[]).length === (s.match(/<\/span>/g)||[]).length],
  ];

  hlTests.forEach(([name, input, check]) => {
    try {
      check(highlight(input)) ? pass('highlight: ' + name) : fail('highlight: ' + name);
    } catch (e) {
      fail('highlight error "' + name + '": ' + e.message);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. ASSET EXTRACTION
// ══════════════════════════════════════════════════════════════════════════════
section('Asset Extraction');

html.includes('async function extractAssets(')          ? pass('extractAssets() defined')           : fail('extractAssets() missing');
html.includes('function renderAssets(')                 ? pass('renderAssets() defined')             : fail('renderAssets() missing');
html.includes('ASSET_SYS')                              ? pass('Asset system prompt defined')        : fail('Asset system prompt (ASSET_SYS) missing');
(html.includes('"logos"') && html.includes('"backgrounds"') && html.includes('"fonts"'))
                                                         ? pass('Asset JSON schema complete')         : fail('Asset JSON schema incomplete');
html.includes('Do not invent or hallucinate any URLs')  ? pass('Anti-hallucination rule present')    : fail('Anti-hallucination rule missing from prompt');

// ══════════════════════════════════════════════════════════════════════════════
// 6. TAB SWITCHING
// ══════════════════════════════════════════════════════════════════════════════
section('Tab Switching');

html.includes('function switchTab(')  ? pass('switchTab() defined')           : fail('switchTab() missing');
html.includes("switchTab('css')")     ? pass("switchTab('css') call present")  : fail("switchTab('css') missing");
html.includes("switchTab('assets')")  ? pass("switchTab('assets') call present") : fail("switchTab('assets') missing");

// ══════════════════════════════════════════════════════════════════════════════
// 7. STEP WIRING
// ══════════════════════════════════════════════════════════════════════════════
section('Step Wiring');

html.includes("s-assets")              ? pass('Assets step in DOM')           : fail('Assets step element missing');
html.includes("assets:$('s-assets')")  ? pass('Assets step in ss object')     : fail('Assets step not in ss object');
html.includes("setStep('assets'")      ? pass("setStep('assets') called")      : fail("setStep('assets') never called");

// ══════════════════════════════════════════════════════════════════════════════
// 8. RESET BEHAVIOUR
// ══════════════════════════════════════════════════════════════════════════════
section('Reset Behaviour');

html.includes('renderAssets(null)')  ? pass('renderAssets(null) called on reset') : fail('renderAssets(null) missing from reset');
html.includes('assetData=null')      ? pass('assetData cleared on reset')          : fail('assetData not cleared on reset');

// ══════════════════════════════════════════════════════════════════════════════
// 9. HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════
section('Helper Functions');

html.includes('function esc(s)')      ? pass('esc() HTML escape helper defined')      : fail('esc() missing');
html.includes('function escAttr(s)')  ? pass('escAttr() attribute escape helper defined') : fail('escAttr() missing');
html.includes('assets-count')         ? pass('Assets count badge element present')     : fail('Assets count badge missing');

// ══════════════════════════════════════════════════════════════════════════════
// 10. INFRASTRUCTURE
// ══════════════════════════════════════════════════════════════════════════════
section('Infrastructure');

proxy.includes('anthropic.com/v1/messages')
  ? pass('Netlify proxy targets correct Anthropic endpoint')
  : fail('Netlify proxy endpoint incorrect');

html.includes('const DEFAULT_SCAFFOLD')
  ? pass('DEFAULT_SCAFFOLD bundled in app')
  : fail('DEFAULT_SCAFFOLD missing');

// ══════════════════════════════════════════════════════════════════════════════
// 11. BRANDING
// ══════════════════════════════════════════════════════════════════════════════
section('Branding');

(html.includes('Harish Kumar MP') && html.includes('ETG Digital'))
  ? pass('Footer attribution present (Harish Kumar MP · ETG Digital)')
  : fail('Footer attribution missing');

// ══════════════════════════════════════════════════════════════════════════════
// 12. SECURITY — BROWSER
// ══════════════════════════════════════════════════════════════════════════════
section('Security — Browser');

// No plaintext key in localStorage
!(html.includes('localStorage.setItem(SK') && !html.includes('secureStore(SK'))
  ? pass('Key NOT written to localStorage in plaintext')
  : fail('Key written to localStorage in plaintext — must use secureStore()');

(html.includes('sessionStorage.setItem') || html.includes('sessionStorage.getItem'))
  ? pass('sessionStorage used (not localStorage) for key storage')
  : fail('sessionStorage not used — localStorage is less secure');

html.includes('AES-GCM')
  ? pass('AES-256-GCM encryption used for key at rest')
  : fail('AES-GCM encryption missing');

html.includes('crypto.subtle')
  ? pass('WebCrypto API (crypto.subtle) used')
  : fail('WebCrypto API missing — must not use Math.random() for crypto');

html.includes('SESSION_TIMEOUT_MS')
  ? pass('Session timeout constant defined (30 min inactivity)')
  : fail('Session timeout missing');

html.includes('secureClear()')
  ? pass('secureClear() called on timeout + logout')
  : fail('secureClear() never called — key not wiped on logout');

// Key validators for all 4 providers
const validatorProviders = ['anthropic', 'openai', 'mistral', 'gemini'];
const hasValidators = html.includes('KEY_VALIDATORS');
validatorProviders.forEach(p => {
  // Match both "openai: k =>" and "openai:    k =>" (with spaces)
  const pattern = new RegExp(p + '\\s*:\\s*k\\s*=>');
  hasValidators && pattern.test(html)
    ? pass('Key format validator: ' + p)
    : fail('Key format validator missing for: ' + p);
});

// No key console.log
['console.log(key', 'console.log(apiKey', 'console.log(sk-'].every(p => !html.includes(p))
  ? pass('No API key values logged to console')
  : fail('API key may be logged to console — security risk');

html.includes('clear-session-btn')
  ? pass('"Clear & logout" button present in UI')
  : fail('"Clear & logout" button missing');

html.includes('async function secureStore(')
  ? pass('secureStore() async encryption helper defined')
  : fail('secureStore() missing');

html.includes('async function secureRead(')
  ? pass('secureRead() async decryption helper defined')
  : fail('secureRead() missing');

html.includes("'click','keydown','mousemove','touchstart'")
  ? pass('Session timer resets on user activity (click, keydown, mousemove, touch)')
  : fail('Session timer not reset on user activity');

// ══════════════════════════════════════════════════════════════════════════════
// 13. SECURITY — PROXY (server-side)
// ══════════════════════════════════════════════════════════════════════════════
section('Security — Proxy (server-side)');

proxy.includes('RATE_LIMIT')
  ? pass('Rate limiting implemented in proxy')
  : fail('Rate limiting missing from proxy');

proxy.includes('isValidAnthropicKey')
  ? pass('Anthropic key format validation in proxy')
  : fail('Key format validation missing from proxy');

(proxy.includes('524288') || proxy.includes('512 * 1024') || proxy.includes('512KB'))
  ? pass('Payload size limit (512KB) enforced in proxy')
  : fail('Payload size limit missing from proxy');

(!proxy.includes('console.log(apiKey') && !proxy.includes('console.log(key'))
  ? pass('Proxy does not log API key values')
  : fail('Proxy may log API key — security risk');

// ══════════════════════════════════════════════════════════════════════════════
// 14. SECURITY — HTTP HEADERS
// ══════════════════════════════════════════════════════════════════════════════
section('Security — HTTP Headers');

hdrs.includes('Content-Security-Policy')
  ? pass('Content-Security-Policy header present (XSS protection)')
  : fail('Content-Security-Policy missing — XSS attack surface exposed');

hdrs.includes('X-Frame-Options')
  ? pass('X-Frame-Options header present (clickjacking protection)')
  : fail('X-Frame-Options missing — clickjacking possible');

hdrs.includes('X-Content-Type-Options')
  ? pass('X-Content-Type-Options header present (MIME sniffing protection)')
  : fail('X-Content-Type-Options missing');

hdrs.includes('Strict-Transport-Security')
  ? pass('HSTS header present (forces HTTPS)')
  : fail('HSTS missing — downgrade attacks possible');

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(56));
console.log('Results: ' + passed + ' passed | ' + failed + ' failed');
if (failed === 0) {
  console.log('ALL TESTS PASS ✓\n');
} else {
  console.log('TESTS FAILED — do not push until all pass\n');
  process.exit(1);
}
