# SF Next Theme Extractor

> A browser-based tool that generates production-ready **Salesforce Commerce Cloud / Salesforce Next** theme CSS files from any brand URL — powered by your own AI API key.

![BYOK](https://img.shields.io/badge/BYOK-4%20providers-orange)
![Netlify](https://img.shields.io/badge/deploy-Netlify-00C7B7)
![Tests](https://img.shields.io/badge/tests-90%20passing-brightgreen)
![Security](https://img.shields.io/badge/security-AES--256--GCM-blue)

---

## What it does

1. Enter any brand URL (e.g. `https://www.puma.com`)
2. The AI researches the brand's design system — colours, fonts, header style, button shapes, logo treatment
3. Generates a complete, production-ready `theme-brandname.css` filling the Salesforce Next scaffold
4. Extracts brand assets — logos, background images, and fonts — with previews and copy buttons
5. Download the CSS file, copy asset URLs, and drop into your Salesforce Next project

---

## Supported AI providers

| Provider | Free tier | Web search | API call method |
|---|---|---|---|
| **Anthropic Claude** | $5 credit on signup | ✅ Live web search during extraction | Via Netlify serverless proxy (required — Anthropic blocks browser CORS) |
| **OpenAI GPT-4o** | $5 credit on signup | ❌ Training knowledge | Direct browser → API |
| **Mistral AI** | ✅ Fully free | ❌ Training knowledge | Direct browser → API |
| **Google Gemini** | ✅ Fully free | ❌ Training knowledge | Direct browser → API |

> **Tip:** Anthropic gives the most accurate results because it can live-search the brand's stylesheet at extraction time. Mistral and Gemini are 100% free with no credit card required.

---

## Project structure

```
sfnext-theme-extractor/
├── netlify.toml                         ← Build + functions config
├── netlify/
│   └── functions/
│       └── anthropic-proxy.js           ← Serverless proxy (Anthropic only)
├── public/
│   ├── index.html                       ← Entire frontend app (single file)
│   └── _headers                         ← Security headers (CSP, HSTS, etc.)
├── tests/
│   ├── test_app.js                      ← Unit + regression tests (90 tests)
│   └── validate_css.js                  ← CSS output validator (23 checks)
└── README.md
```

---

## Deploy to Netlify

Netlify is required for full functionality — it runs both the static frontend and the Anthropic serverless proxy for free.

### GitHub + Netlify (recommended)

1. Push this repo to GitHub
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
3. Connect to GitHub and select this repo
4. Build settings are auto-detected from `netlify.toml`:
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
5. Click **Deploy site**
6. Live at `https://your-site-name.netlify.app` — no environment variables needed

> ⚠️ **Netlify Drop** does **not** run serverless functions. Anthropic extraction won't work via Drop. Use GitHub + Netlify for full functionality.

---

## Getting your API key

| Provider | Where to get it | Key format |
|---|---|---|
| Anthropic | https://console.anthropic.com/settings/keys | `sk-ant-api03-…` |
| OpenAI | https://platform.openai.com/api-keys | `sk-proj-…` |
| Mistral AI | https://console.mistral.ai/api-keys | 32-char alphanumeric |
| Google Gemini | https://aistudio.google.com/app/apikey | `AIzaSy…` |

---

## Security model

This tool handles sensitive API keys. Every measure below is covered by automated tests.

### Browser (frontend)

| Measure | Detail |
|---|---|
| **AES-256-GCM encryption** | Key encrypted with WebCrypto before `sessionStorage`. The encryption key is in memory only — never persisted anywhere. |
| **sessionStorage only** | Not `localStorage`. Data is gone when the tab closes, not shared across tabs. |
| **30-minute session timeout** | Inactivity auto-clears key from memory and storage, returns to login screen. |
| **Clear & logout button** | One-click wipe of all session data from memory and storage. |
| **Key format validation** | Client-side regex rejects malformed keys before any network call. |
| **No console logging** | Key values are never written to `console.log`. |
| **No URL params** | Keys never appended to URLs (except Gemini — see note below). |

### Server (Netlify proxy — Anthropic only)

| Measure | Detail |
|---|---|
| **Rate limiting** | Max 10 requests / 60-second window per IP. Returns `429` when exceeded. |
| **Key format validation** | Rejects malformed Anthropic keys before forwarding. |
| **Payload size limit** | Requests over 512 KB rejected with `413`. |
| **No key logging** | Key forwarded to Anthropic and immediately discarded. Never stored, never logged. |
| **JSON validation** | Body must be valid JSON before forwarding. |
| **Error scrubbing** | Error messages returned to the browser never contain the API key. |

### HTTP security headers (`public/_headers`)

| Header | Protection |
|---|---|
| `Content-Security-Policy` | Blocks XSS injection, restricts script sources, disables iframes |
| `X-Frame-Options: DENY` | Prevents clickjacking |
| `X-Content-Type-Options: nosniff` | Prevents MIME-type sniffing attacks |
| `Strict-Transport-Security` | Forces HTTPS for 2 years (HSTS preload) |
| `Referrer-Policy` | Limits referrer data sent to third parties |
| `Permissions-Policy` | Disables camera, microphone, geolocation |
| `X-XSS-Protection` | Legacy XSS filter for older browsers |

### Known limitation

**Gemini** requires the API key as a URL query parameter (`?key=`) — this is Google's own API design and cannot be changed from our side. The key will be visible in browser DevTools Network tab for Gemini requests. If this is a concern, use Anthropic, OpenAI, or Mistral instead.

---

## CSS scaffold

The tool ships with the Salesforce Next `theme-sample.css` scaffold bundled. Drag and drop your own updated scaffold at any time.

The scaffold structure that gets filled:

```
1. Base @imports          — never changed
2. Brand header comment   — brand name, URL, generation date
3. @theme inline fonts    — --font-sans, --font-serif, --font-mono
4. :root colour tokens    — all design tokens
5. Logo size overrides    — mobile + desktop heights
6. Primary CTA buttons    — border-radius, bg, hover, active states
7. Search bar override    — commented out unless clearly needed
```

---

## Assets & Fonts tab

After CSS extraction completes, a second AI call extracts brand assets:

- **Logos** — image preview, usage context (header/footer/favicon), URL, Copy button
- **Background images** — preview panel, usage context, URL, Copy button
- **Fonts** — name, role, source type, direct Google Fonts link where applicable

The Assets tab shows a count badge once complete. If CSS succeeds but asset extraction fails, the CSS is still delivered with a warning toast.

---

## Running the tests

```bash
# Install Node.js (v18+) if not already installed

# Unit + regression + security tests (90 tests)
node tests/test_app.js

# CSS output validator — run against a generated theme file
node tests/validate_css.js public/theme-sample.css path/to/theme-output.css
```

All tests must pass before any commit to `main`.

### Test coverage summary

| Category | Count | What is tested |
|---|---|---|
| JS syntax | 1 | Full script block parses without errors |
| DOM structure | 29 | All required element IDs present |
| Provider config | 8 | All 4 providers have card UI + config object |
| Syntax highlighter | 9 | Each token type, no text leakage, escaping, balanced spans |
| Asset extraction | 5 | Functions defined, JSON schema, anti-hallucination rules |
| Tab switching | 3 | switchTab(), CSS tab, assets tab |
| Step wiring | 3 | Assets step in DOM, ss object, setStep called |
| Reset behaviour | 2 | Assets cleared, assetData nulled on reset |
| Helper functions | 3 | esc(), escAttr(), assets count badge |
| Infrastructure | 2 | Netlify proxy intact, DEFAULT_SCAFFOLD present |
| Branding | 1 | Footer attribution present |
| **Security — browser** | 11 | No plaintext localStorage, AES-GCM, WebCrypto, session timeout, secureClear, key validators x4, no console.log, clear button, secureStore/secureRead, session timer |
| **Security — proxy** | 4 | Rate limiting, key format validation, payload size limit, no key logging |
| **Security — headers** | 4 | CSP, X-Frame-Options, X-Content-Type-Options, HSTS |
| **CSS validator** | 23 | Full scaffold compliance (run separately via validate_css.js) |
| **Total** | **90** | |

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-20 | Initial release — CSS theme extraction, 4 AI providers, BYOK |
| v1.1 | 2026-05-20 | Fixed Anthropic CORS — Netlify serverless proxy added |
| v1.2 | 2026-05-20 | Added Assets & Fonts tab — logos, backgrounds, font discovery |
| v1.3 | 2026-05-21 | Security hardening — AES-256-GCM encryption, CSP headers, rate limiting, 30-min session timeout, 90 tests passing |

---

## Built by

Designed & Developed by **Harish Kumar MP** · ETG Digital

---

## License

MIT — free to use, modify, and distribute.
