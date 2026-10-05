# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + Vue 3 for the web frontend; Cloudflare Workers for REST, Workers AI, and remote MCP; MyGo for desktop packaging.

## Users

Manga creators and storyboard/comic learners who need to explore panel layouts quickly.

## Product Purpose

A browser tool for generating bundles of manga panel layouts, reviewing variations, and exporting chosen layouts for drawing workflows. Success means a user can produce a useful panel arrangement, compare nearby variations, and save it without leaving the browser.

## Positioning

The tool turns panel-layout exploration into a fast, repeatable generation workflow: one seed produces a bundle of layouts, and a selected layout can be structurally mutated into related variations.

## Operating Context

Users work in a browser or MyGo desktop client while planning manga pages, storyboards, or exercises. Reading order is right-to-left and top-to-bottom. Export targets include SVG, PNG, and GIMP-compatible layered OpenRaster.

## Capabilities and Constraints

The tool mirrors the reference site's visible behavior and appearance: layout style presets, page size presets, row-count presets, randomized panel traits, bundle generation, seed display, reading-order numbering, inner-frame guides, dialogue-box varieties, previous/next navigation, mutation from the current layout, SVG/PNG/ORA export, multilingual UI in Japanese, English, and Simplified Chinese, AI storyboard generation, emotional layout guidance, and agent-facing REST/MCP endpoints. The storyboard decision path uses a manga-author rubric to classify dramatic scenario and score layout geometry before Cloudflare Workers AI judges a shortlist; the same rubric provides the deterministic fallback. MyGo builds the same frontend into desktop clients.

## Brand Commitments

Product language follows the reference tool's Japanese terminology and compact utility tone. The working title is コマ割りジェネレーター.

## Evidence on Hand

Reference site: https://tools.oyasumi-gamedev.com/komawari/

## Product Principles

- Show the generated layout immediately; the panel arrangement is the product.
- Keep controls compact, explicit, and fast to scan.
- Preserve reading order and export fidelity.
- Make variation easy without losing the selected structure.

## Accessibility & Inclusion

Interactive controls need visible labels, keyboard access, focus states, and usable touch targets while preserving the dense reference layout.
