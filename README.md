# Manga Layout Generator

A deterministic manga panel-layout generator with browser, Cloudflare Worker, and MyGo desktop clients.

## Web

```sh
npm install
npm run dev
```

`npm run build` creates the Vite frontend in `dist/`.

## Features

- Japanese, English, and Simplified Chinese UI
- Seeded manga panel bundles with mutation mode
- Speech, whisper, shout, thought, caption, and mixed dialogue-box overlays
- SVG and PNG exports
- Layered OpenRaster (`.ora`) export for GIMP/Krita; open it in GIMP and Save As XCF when a native XCF is required
- Context-first storyboard generation through Cloudflare Workers AI
- Manga-author decision rubric that pre-ranks candidates for scenario, pacing, hierarchy, readability, and panel count before the LLM judges a shortlist
- Emotional layout guidance in a dedicated workspace and new tab

## Cloudflare Worker API

The deployed Worker serves the frontend and these agent-facing endpoints:

- `GET /api/health`
- `POST /api/storyboard`
- `POST /api/emotional-tips`
- `GET /api/mcp/tools`
- `GET /.well-known/mcp.json`
- `POST /mcp` — stateless Streamable HTTP MCP transport

Deploy with:

```sh
npm run build:web
wrangler deploy
```

The Worker uses the `AI` binding with Cloudflare's JSON-mode-compatible `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. A deterministic manga-author rubric extracts the dramatic scenario, scores candidate geometry, and sends only the strongest shortlist to the LLM. If Workers AI is unavailable, the same rubric returns a deterministic fallback and identifies it in `decisionModel`.

### MCP tools

- `generate_storyboard`: apply the manga-author rubric, let the Cloudflare decision model judge the shortlist, and return structured production prompts
- `get_emotional_tips`: return emotional composition guidance
- `select_best_layout`: deterministic ranking by scenario, pacing, hierarchy, readability, and panel count

MCP clients should send `Accept: application/json, text/event-stream` on `/mcp` requests.

## MyGo desktop clients

The same Vue frontend is embedded in a MyGo desktop app for macOS, Windows, and Linux.

```sh
npx mygo-cli dev
npx mygo-cli build --platform linux/amd64
```

The GitHub Actions workflow builds:

- macOS universal
- Windows amd64 and arm64
- Linux amd64 and arm64

Push a `v*` tag to run the release workflow. GitHub Actions publishes the compiled desktop bundle to the GitHub release.

## Live deployment

- Worker: https://manga-layout.jstdlee.workers.dev
- Repository: https://github.com/jstdlee/manga-layout
- Release: https://github.com/jstdlee/manga-layout/releases/tag/v0.1.3
