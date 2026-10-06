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
- Manga-author decision rubric that pre-ranks candidates for scenario, pacing, hierarchy, readability, and panel count before the LLM judges a shortlist
- Multi-round CF-JEV decision loop: the GLM judge scores narrative, pacing, reading flow, hierarchy, emotion, and production quality each round, reports deficits and targeted mutations, and iterates until the quality threshold passes or the round budget ends
- Scenario-aware bubble planning: the storyboard writer inserts speech, thought/monologue, whisper, shout, broadcast, caption, and SFX bubbles per panel, rendered into the selected layout and exported to SVG/PNG/ORA
- Token-gated access: every page and API requires a shared access token (`ACCESS_TOKEN` Worker secret); agents may send `Authorization: Bearer <token>` instead of the login cookie
- Emotional layout guidance in a dedicated workspace and new tab

## Cloudflare Worker API

The deployed Worker serves the frontend and these agent-facing endpoints:

- `GET /api/health`
- `POST /api/storyboard`
- `POST /api/emotional-tips`
- `GET /api/mcp/tools`
- `GET /.well-known/mcp.json`
- `GET /login` and `POST /auth/login` (form or JSON `{"token": …}`), `GET|POST /auth/logout`
- `POST /mcp` — stateless Streamable HTTP MCP transport

Deploy with:

```sh
npm run build:web
wrangler deploy
```

The Worker uses the `AI` binding with `@cf/zai-org/glm-5.3-flash` (JSON-schema output). A deterministic manga-author rubric extracts the dramatic scenario, scores candidate geometry, and a CF-JEV judge runs up to 3 decision rounds before the storyboard writer produces prompts and bubbles. If Workers AI is unavailable, the same rubric returns a deterministic fallback and identifies it in `decisionModel`.

Set the access token with `wrangler secret put ACCESS_TOKEN` (or `.dev.vars` locally). Without it the Worker refuses to authenticate; keep the token out of git.

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
