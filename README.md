# SF Next Theme Extractor

> A browser-based tool that generates production-ready **Salesforce Commerce Cloud / Salesforce Next** theme CSS files from any brand URL — powered by your own AI API key.

![BYOK](https://img.shields.io/badge/BYOK-4%20providers-orange)
![Netlify](https://img.shields.io/badge/deploy-Netlify-00C7B7)

---

## Supported AI providers

| Provider | Free tier | Web search | How it calls the API |
|---|---|---|---|
| **Anthropic Claude** | $5 credit on signup | ✅ Live web search | Via Netlify serverless function (CORS bypass) |
| **OpenAI GPT-4o** | $5 credit on signup | ❌ Training knowledge | Direct from browser |
| **Mistral AI** | ✅ Fully free | ❌ Training knowledge | Direct from browser |
| **Google Gemini** | ✅ Fully free | ❌ Training knowledge | Direct from browser |

> **Why does Anthropic need a proxy?** Anthropic's API blocks direct browser calls (CORS policy). The included Netlify function forwards your request server-side. Your key is never stored — it's passed through in the request header and sent straight to Anthropic.

---

## Project structure

```
sfnext-theme-extractor/
├── netlify.toml                        ← Tells Netlify where things are
├── netlify/
│   └── functions/
│       └── anthropic-proxy.js          ← Serverless proxy for Anthropic only
├── public/
│   └── index.html                      ← The entire frontend app
└── README.md
```

---

## Deploy to Netlify (recommended)

Netlify is the only host that runs both the static frontend AND the serverless function for free.

### Option A — Netlify Drop (quickest, no account needed for a test)

1. Drag the entire `sfnext-theme-extractor` **folder** onto **https://app.netlify.com/drop**
2. Done — live URL in seconds

> ⚠️ Netlify Drop doesn't run serverless functions. Anthropic won't work via Drop — use Option B for full functionality.

### Option B — GitHub + Netlify (full, recommended)

1. Push this repo to GitHub
2. Go to https://app.netlify.com → **Add new site** → **Import an existing project**
3. Connect to GitHub, select this repo
4. Build settings (Netlify auto-detects from `netlify.toml`):
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
5. Click **Deploy site**
6. Your app will be live at `https://your-site-name.netlify.app`

That's it — no environment variables needed. Users supply their own API keys in the browser.

---

## Getting your API key

| Provider | Where to get it |
|---|---|
| Anthropic | https://console.anthropic.com/settings/keys |
| OpenAI | https://platform.openai.com/api-keys |
| Mistral AI | https://console.mistral.ai/api-keys |
| Google Gemini | https://aistudio.google.com/app/apikey |

Keys are stored only in the user's own browser `localStorage`. They are never logged or stored on the server.

---

## How it works

1. User selects a provider and enters their API key
2. Key is validated with a real test call before saving
3. User enters a brand URL and clicks **Extract Theme**
4. The AI researches the brand and fills the Salesforce Next CSS scaffold
5. The result is displayed with syntax highlighting, ready to copy or download

---

## License

MIT
