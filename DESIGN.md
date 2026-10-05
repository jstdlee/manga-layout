# Design System

## Product surface

`/` is a compact operate-mode manga panel layout generator. The generated panel sheet is the primary artifact; controls exist to tune and reproduce it.

## Visual direction

Cool paper / production utility: a pale blue-gray workspace, white page sheets, graphite panel frames, and one production blue for actions, guides, and reading-order markers. The interface uses dense Swiss-like rows rather than decorative cards.

## Tokens

- Background: `#EDF1F4`; dark mode `#0F151B`
- Surface: `#FBFCFD`; dark mode `#161E26`
- Ink: `#182430`; dark mode `#E4ECF2`
- Muted text: `#5B6E7E`; dark mode `#8FA3B2`
- Accent: `#1E78C8`; dark mode `#4EA3E8`
- Border: `#C9D4DC`; soft border `#DCE4EA`
- Sheet: `#FFFFFF`; panel frame `#101417`
- UI type: Japanese system sans stack
- Numeric type: `ui-monospace` stack for seeds, counts, and metadata

## Composition

- Header is a thin title strip with a letter-spaced utility label.
- Generation settings sit in one bordered surface with three scan lines: presets, dimensions/sliders, and seed/actions.
- Generated layouts form a responsive auto-fill gallery of page thumbnails.
- The preview dialog enlarges one sheet and keeps previous / mutation / export / next actions adjacent.
- Help content is an open footer details block, not an interruption.

## Interaction grammar

- Blue filled buttons are primary generation/export actions; outlined buttons are navigation or escape actions.
- Thumbnails lift slightly on hover and use visible focus outlines.
- Mutation mode keeps the chosen base visually outlined and dims controls that no longer apply.
- Layout generation is deterministic for a given seed and configuration; mutation uses deterministic derived seeds.
- `prefers-reduced-motion` removes nonessential transitions.

## Responsive rules

- Desktop gallery uses minimum 168px columns within a 1280px content cap.
- Mobile switches the gallery to minimum 130px columns and sliders to two columns.
- Mobile preview actions become a two-column grid while preserving previous/next order.

## New workspaces

- `AI storyboard` is a context-first form. World, chapter, plot, events, setting, characters, style, panel target, dialogue density, temperature, max tokens, and an editable prompt instruction are visible before generation.
- `Emotional direction` is a quieter read/operate workspace with a small set of reusable emotional beats and an optional new-tab launch.
- Story results are structured as a scenario decision summary, confidence, ranked candidates, and one production prompt per story box.

## Export and agent grammar

- Dialogue-box overlays are optional and deterministic by seed; styles include speech, whisper, shout, thought, caption, and mixed.
- ORA is labeled as OpenRaster, not XCF. It carries a background, one layer per panel, optional guide, and optional dialogue layers.
- Cloudflare Worker endpoints expose health, storyboard generation, emotional tips, and `/mcp`. The MCP server advertises tools for storyboard generation, emotional guidance, and layout selection.
- Cloudflare Workers AI receives a deterministic manga-author rubric: scenario classification plus candidate geometry scores for pacing, hierarchy, readability, and panel count. It judges a shortlist, while the same rubric remains the fallback when AI is unavailable.

## Desktop

The same frontend is embedded into a MyGo web-frontend desktop app. `mygo.config.ts` keeps the visual surface shared between browser and packaged macOS, Windows, and Linux clients.
