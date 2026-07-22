# SnipLingo

SnipLingo is a browser extension that allows you to easily select an area on any web page, recognize text from the captured image using OCR, and translate it into your language of choice.

## Features

- ✂️ **Area Selection:** Select any specific area of a webpage to capture text from images, videos, or protected documents.
- 🔍 **Offline OCR:** Built-in optical character recognition (OCR) using [Tesseract.js](https://tesseract.projectnaptha.com/), supporting English and Russian locally without needing external APIs.
- 🌍 **Translation:** Quickly translate recognized text into multiple languages using a dedicated backend server.
- 📋 **Copy to Clipboard:** Easily copy the recognized or translated text with a single click.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js)

## Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/Darmanchev/sniplingo.git
cd sniplingo
npm install
```

### Environment Variables

To run the translation backend, you'll need to set up your environment variables. 
Copy the example file to create a new `.env` file:

```bash
cp .env.example .env
```

*Make sure to configure the required API keys or variables inside `.env` depending on your backend setup.*

## Development

SnipLingo consists of the browser extension and a translation backend.

1. **Start the translation backend:**
   ```bash
   npm run dev:backend
   ```
   *This starts the local translation API server on `http://127.0.0.1:8787`.*

2. **Start the extension in development mode:**
   Open a new terminal window and run:
   ```bash
   npm run dev
   ```
   *(For Firefox, run `npm run dev:firefox`)*

This will automatically open a new browser instance with the extension installed.

## Building for Production

Set the public HTTPS endpoint used by the extension (the `.example` domain is
only a placeholder). Export it for the build shell or put it in an untracked
`.env.production.local` file:

```bash
WXT_TRANSLATION_API_URL=https://api.your-domain.com/v1/translate npm run build
```

Production builds reject missing, HTTP, localhost, and `127.0.0.1` API URLs.
The generated manifest grants access only to the configured API origin. Local
backend access is added only by `wxt` development builds.

To build the extension for production deployment:

```bash
# Build for Chrome
npm run build

# Build for Firefox
npm run build:firefox
```

To create a `.zip` archive ready for publishing to the Chrome Web Store or Firefox Add-ons:

```bash
# Zip for Chrome
npm run zip

# Zip for Firefox
npm run zip:firefox
```

The Firefox package is version `0.1.0`, uses the stable extension ID
`sniplingo@darmanchev`, and declares required `websiteContent` transmission.
Firefox 140 or newer is required so the built-in data-consent prompt is always
available. Validate the generated package before release:

```bash
WXT_TRANSLATION_API_URL=https://api.your-domain.com/v1/translate npm run build:firefox
WXT_TRANSLATION_API_URL=https://api.your-domain.com/v1/translate npm run check:firefox-manifest
npm run lint:firefox
WXT_TRANSLATION_API_URL=https://api.your-domain.com/v1/translate npm run zip:firefox
```

To request an AMO Unlisted signature, create AMO API credentials and export
`WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`, then run `npm run sign:firefox`.
The signed XPI is written to `.output/signed`.

## Technologies Used

- [WXT](https://wxt.dev/) - Next-gen framework for browser extensions.
- [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript.
- [Tesseract.js](https://tesseract.projectnaptha.com/) - Pure Javascript OCR.

## Production backend on Contabo

The backend has no runtime npm dependencies. The included `compose.yaml` runs
it as a read-only, automatically restarting container and exposes it only on
`127.0.0.1:8787`. A reverse proxy on the VPS must terminate TLS and forward the
public HTTPS endpoint to that address. `deploy/Caddyfile.example` contains a
minimal Caddy configuration; replace its placeholder domain first.

Required production variables:

```dotenv
NODE_ENV=production
DEEPL_API_KEY=server-only-secret
TRANSLATION_SERVER_HOST=0.0.0.0
TRANSLATION_SERVER_PORT=8787
ALLOWED_CHROME_EXTENSION_IDS=published-chrome-extension-id
TRUST_PROXY=true
LOG_REQUEST_METRICS=false
GLOBAL_DAILY_CHARACTER_LIMIT=250000
```

Prepare and start the backend on the VPS:

```bash
cp .env.production.example .env.production
# Fill in DEEPL_API_KEY, ALLOWED_CHROME_EXTENSION_IDS, and your API domain.
docker compose --env-file .env.production up -d --build
docker compose ps
curl https://api.your-domain.com/health
```

The firewall should expose only SSH, HTTP, and HTTPS. Port `8787` remains bound
to localhost and must not be opened publicly. Build the browser packages only
after the HTTPS endpoint works, using the same domain in
`WXT_TRANSLATION_API_URL`.

`render.yaml` remains available as an alternative managed deployment and is
not used by the Contabo setup.

Only enable `TRUST_PROXY` when the platform overwrites `X-Forwarded-For` and
does not pass a client-supplied value through. Do not put `DEEPL_API_KEY` in any
`WXT_`, browser, build, or client-side environment variable.

Default protection:

- 32 KiB JSON request-body limit and 10,000 Unicode code points per text;
- 20 requests per minute and 40,000 characters per 24-hour window per IP;
- a 250,000-character global 24-hour budget, in addition to DeepL's provider
  quota guard;
- in-memory entries removed by TTL timers; use Redis or another shared store
  before running more than one backend instance;
- DeepL `/usage` refresh every five minutes, local character accounting, and
  new translations stopped at 95% of the provider quota;
- at most two retries for DeepL `429`, using exponential backoff;
- extension-origin filtering. Firefox UUID origins are necessarily dynamic;
  this filter, like CORS, is not authentication.

Per-request application logs are disabled by default. `LOG_USAGE_METRICS=true`
emits aggregate daily character totals only. If `LOG_REQUEST_METRICS=true` is
explicitly enabled, logs contain request ID, status, duration, character count,
target language, and error type, but never request or response text. Exact
addresses in `BLOCKED_CLIENT_ADDRESSES` are rejected without logging translated
text. Configure the reverse proxy, hosting platform, APM, and error monitoring
not to capture request/response bodies, `Authorization` headers, or environment
variables.

The in-memory rate limits are intentionally single-instance. Before scaling to
multiple backend replicas, replace them with atomic Redis counters with TTLs;
otherwise each replica enforces a separate budget. CORS and Origin checks are
not authentication and do not prevent scripted abuse.

See [PRIVACY.md](./PRIVACY.md) for the release privacy policy.

## Verification

```bash
npm run compile
npm test
npm run test:ocr
npm run test:e2e
```

The browser E2E opens a real Chromium extension, selects rendered text,
captures it, runs packaged local OCR, and translates through a local mock API.
Crop unit tests cover 80%, 100%, 125%, 150%, 200%, independent axes, and 2×
HiDPI screenshots. Multi-monitor behavior still requires a manual Firefox test
because browser automation cannot move a Firefox window between physical
displays in CI.

Strict `web-ext lint` ignores only the packaged Tesseract worker, whose upstream
compatibility fallbacks trigger known static-analysis warnings. No remote code
is loaded; the OCR worker, WebAssembly core, and language models are shipped in
the extension. Review the vendored worker again whenever Tesseract is updated.
