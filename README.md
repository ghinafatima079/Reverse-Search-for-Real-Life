# Reverse Search for Real Life

A minimal Next.js + Tailwind app to upload a product image, send it to Google Vision, extract brand/product/model, and surface helpful resource search links (User Manual, Setup Guide, Troubleshooting, YouTube Tutorials).

Features
- Drag/select image upload
- Server API that calls Google Cloud Vision (`images:annotate`)
- Heuristics to extract brand/product/model
- Apple-style clean UI with loading animations

Setup
1. Install deps:

```bash
npm install
```

2. Set env vars for your image model API keys. You can use Google Vision or Gemini.

- Use a `.env.local` file at the project root (recommended). Copy `.env.local.example` and fill values.

Example `.env.local` entries:

```
GOOGLE_API_KEY=YOUR_GOOGLE_VISION_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=your-gemini-model-name
# Optional: parser model to run a small text extraction pass (defaults to GEMINI_MODEL when unset)
# GEMINI_PARSER_MODEL=your-parser-model-name
```

On Windows (PowerShell) you can set them for the session instead:

```powershell
$Env:GOOGLE_API_KEY = "YOUR_GOOGLE_KEY"
$Env:GEMINI_API_KEY = "YOUR_GEMINI_KEY"
$Env:GEMINI_MODEL = "your-gemini-model-name"
```

Quick local testing (no API keys)
- Set `USE_MOCK=true` in your `.env.local` to enable mock results for frontend testing without real API keys.

Run the E2E test
1. Install dev deps (Playwright is required):

```bash
npm install
npx playwright install --with-deps
```

2. Run the E2E script (it starts the dev server in mock mode, runs a browser flow, then shuts down):

```bash
npm run e2e
```

The test uses a mock response (`USE_MOCK=true`) to avoid external API calls.

3. Run dev server:

```bash
npm run dev
```

Notes
- No authentication or database is used — this is a stateless demo.
- The UI includes an "Engine" selector (top-left) that defaults to Gemini and posts to `/api/vision_gemini`.
	Choose "Google Vision" to use the original `/api/vision` route instead.

Security
- Do not commit your API keys.

Enjoy!"