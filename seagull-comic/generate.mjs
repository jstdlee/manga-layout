// Seagull Fries Heist — 3-page Dragon Ball style gag comic generator
// Uses: local port of the manga-layout generator + the deployed layout MCP (select_best_layout)
//       + OpenRouter google/gemini-3.1-flash-image for panel art.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const PANELS_DIR = path.join(DIR, 'panels')
fs.mkdirSync(PANELS_DIR, { recursive: true })

const WORKER = 'https://manga-layout.jstdlee.workers.dev'
const TOKEN = fs.readFileSync(path.join(DIR, '..', '.dev.vars'), 'utf8').match(/ACCESS_TOKEN=(\S+)/)[1]
const OR_KEY = process.env.OPENROUTER_API_KEY
const IMAGE_MODEL = 'google/gemini-3.1-flash-image'

// ---------- ported deterministic layout generator (from src/App.vue) ----------
const clone = (v) => JSON.parse(JSON.stringify(v))
const lerp = (a, b, t) => a + (b - a) * t
function strHash(value) { let h = 2166136261; for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function mulberry32(value) { return function random() { value |= 0; value = (value + 0x6d2b79f5) | 0; let t = Math.imul(value ^ (value >>> 15), 1 | value); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function irnd(random, min, max) { return min + Math.floor(random() * (max - min + 1)) }
function wpick(random, weights) { const total = weights.reduce((s, w) => s + w, 0); let v = random() * total; for (let i = 0; i < weights.length; i += 1) { v -= weights[i]; if (v < 0) return i } return weights.length - 1 }
function hLine(yLeft, yRight, width) { return { y0: yLeft, m: (yRight - yLeft) / width } }
function vLine(xa, ya, xb, yb) { const k = (xb - xa) / ((yb - ya) || 1e-6); return { x0: xa - k * ya, k } }
function vVert(x) { return { x0: x, k: 0 } }
function isect(horizontal, vertical) { const x = (vertical.x0 + vertical.k * horizontal.y0) / (1 - vertical.k * horizontal.m); return [x, horizontal.y0 + horizontal.m * x] }
function offH(line, d) { return { y0: line.y0 + d, m: line.m } }
function offV(line, d) { return { x0: line.x0 + d, k: line.k } }
function quad(top, bottom, right, left) { return [isect(top, left), isect(top, right), isect(bottom, right), isect(bottom, left)] }
function randomGenome(random, config) {
  const rowCount = irnd(random, config.rowMin, config.rowMax)
  const rowW = Array.from({ length: rowCount }, () => 0.65 + random())
  let bigRow = -1
  if (rowCount > 1 && random() < config.big) { bigRow = irnd(random, 0, rowCount - 1); rowW[bigRow] *= 1.8 + config.big * 1.5 }
  const rowTilt = Array.from({ length: Math.max(0, rowCount - 1) }, () => (random() * 2 - 1) * config.tilt)
  const sum = rowW.reduce((t, w) => t + w, 0)
  const rows = []
  for (let r = 0; r < rowCount; r += 1) {
    const share = rowW[r] / sum
    const w1 = 0.55 + config.big * 2.2 + (r === bigRow ? 2.6 : 0) + (share > 0.45 ? 1.3 : 0)
    const columnCount = wpick(random, [w1, 1.5, 1.05]) + 1
    const colW = Array.from({ length: columnCount }, () => 0.7 + random())
    const colTilt = Array.from({ length: Math.max(0, columnCount - 1) }, () => (random() * 2 - 1) * config.tilt)
    const panels = Array.from({ length: columnCount }, () => ({
      nest: random() < config.nest * (columnCount === 1 ? 0.45 : 1) ? { u: 0.38 + random() * 0.24 } : null,
      bT: random() < config.bleed, bB: random() < config.bleed, bR: random() < config.bleed * 0.9, bL: random() < config.bleed * 0.9,
    }))
    rows.push({ colW, colTilt, panels })
  }
  return { rowW, rowTilt, rows }
}
function realize(genome, config) {
  const height = 1000
  const width = Math.round(height * config.ratio)
  const marginY = 56, marginX = 50, outside = 14, rowGap = 16, colGap = 9
  const inner = { x0: marginX, y0: marginY, x1: width - marginX, y1: height - marginY }
  const innerHeight = inner.y1 - inner.y0, innerWidth = inner.x1 - inner.x0
  const rowCount = genome.rows.length
  const sum = genome.rowW.reduce((t, w) => t + w, 0)
  const rowHeights = genome.rowW.map((w) => (w / sum) * innerHeight)
  const rowBounds = [inner.y0]
  rowHeights.forEach((h) => rowBounds.push(rowBounds[rowBounds.length - 1] + h))
  const rowLines = [hLine(inner.y0, inner.y0, width)]
  for (let i = 1; i < rowCount; i += 1) {
    const d = (genome.rowTilt[i - 1] || 0) * 0.42 * Math.min(rowHeights[i - 1], rowHeights[i])
    rowLines.push(hLine(rowBounds[i] - d, rowBounds[i] + d, width))
  }
  rowLines.push(hLine(inner.y1, inner.y1, width))
  const panels = []
  for (let r = 0; r < rowCount; r += 1) {
    const row = genome.rows[r]
    const topLine = rowLines[r], bottomLine = rowLines[r + 1]
    const columnCount = row.colW.length
    const columnSum = row.colW.reduce((t, w) => t + w, 0)
    const widths = row.colW.map((w) => (w / columnSum) * innerWidth)
    const xBounds = [inner.x1]
    widths.forEach((w) => xBounds.push(xBounds[xBounds.length - 1] - w))
    const topY = topLine.y0 + topLine.m * width / 2
    const bottomY = bottomLine.y0 + bottomLine.m * width / 2
    const verticalLines = [vVert(inner.x1)]
    for (let c = 1; c < columnCount; c += 1) {
      const d = (row.colTilt[c - 1] || 0) * 0.3 * Math.min(widths[c - 1], widths[c])
      verticalLines.push(vLine(xBounds[c] - d, topY, xBounds[c] + d, bottomY))
    }
    verticalLines.push(vVert(inner.x0))
    for (let c = 0; c < columnCount; c += 1) {
      const panel = row.panels[c]
      const isTop = r === 0, isBottom = r === rowCount - 1, isRight = c === 0, isLeft = c === columnCount - 1
      const top = isTop && panel.bT ? hLine(-outside, -outside, width) : offH(topLine, r > 0 ? rowGap / 2 : 0)
      const bottom = isBottom && panel.bB ? hLine(height + outside, height + outside, width) : offH(bottomLine, r < rowCount - 1 ? -rowGap / 2 : 0)
      const right = isRight && panel.bR ? vVert(width + outside) : offV(verticalLines[c], c > 0 ? -colGap / 2 : 0)
      const left = isLeft && panel.bL ? vVert(-outside) : offV(verticalLines[c + 1], c < columnCount - 1 ? colGap / 2 : 0)
      if (panel.nest && rowHeights[r] > 160) {
        const split = panel.nest.u
        const gap = (columnCount === 1 ? rowGap : colGap) / 2
        const middle = hLine(lerp(top.y0, bottom.y0, split), lerp(top.y0 + top.m * width, bottom.y0 + bottom.m * width, split), width)
        panels.push({ pts: quad(top, offH(middle, -gap), right, left) })
        panels.push({ pts: quad(offH(middle, gap), bottom, right, left) })
      } else {
        panels.push({ pts: quad(top, bottom, right, left) })
      }
    }
  }
  return { width, height, inner, panels }
}
function generate(seed, config) { const random = mulberry32(strHash(seed)); const genome = randomGenome(random, config); return { seed, genome, ...realize(genome, config) } }
function polygonArea(points) { return Math.abs(points.reduce((s, p, i) => { const n = points[(i + 1) % points.length]; return s + p[0] * n[1] - n[0] * p[1] }, 0) / 2) }
function layoutDecisionFeatures(layout) {
  const areas = layout.panels.map((p) => polygonArea(p.pts))
  const total = areas.reduce((s, a) => s + a, 0) || 1
  const shares = areas.map((a) => a / total)
  const tilts = [...(layout.genome.rowTilt || []), ...(layout.genome.rows || []).flatMap((r) => r.colTilt || [])]
  const nested = (layout.genome.rows || []).reduce((s, r) => s + r.panels.filter((p) => p.nest).length, 0)
  const bleed = (layout.genome.rows || []).reduce((s, r) => s + r.panels.reduce((ps, p) => ps + ['bT', 'bB', 'bR', 'bL'].filter((e) => p[e]).length, 0), 0)
  return {
    rowCount: layout.genome.rows?.length || 1,
    largestPanelShare: Math.max(...shares), smallestPanelShare: Math.min(...shares),
    firstPanelShare: shares[0] || 0, lastPanelShare: shares[shares.length - 1] || 0,
    hierarchy: Math.max(...shares) - Math.min(...shares),
    tilt: Math.min(1, tilts.reduce((s, v) => s + Math.abs(v), 0) / Math.max(1, tilts.length)),
    nestedPanels: nested, bleedEdges: bleed,
  }
}

// ---------- story: 3 pages ----------
const CHAR_SHEET = 'Characters: KANTA = slim white seagull with one spiky black head feather like Goku and fierce determined eyebrows; POPPO = chubby round seagull with a huge beak and tiny wings. Dragon Ball style black and white manga line art, bold ink outlines, dynamic speed lines, screentone shading, clean white background. NO text, NO letters, NO speech bubbles, no watermark.'
const PAGES = [
  {
    n: 1, scenario: 'establishing', desiredPanels: 5, rows: '2-3',
    mcp: { plot: 'Two seagulls dream of french fries and plan a heist at the beach fry stand', events: 'arrival; drooling; plan briefing', style: 'Dragon Ball style action comedy', dialogueDensity: 'balanced' },
    beats: [
      { art: 'Wide establishing shot: dawn beach, two seagulls perched on a wooden post, a small beach fry stand with umbrella far in the distance', caption: '海边·清晨' },
      { art: 'Close-up of POPPO the chubby seagull drooling, eyes shaped like french fries, longing silly face', bubbles: [{ type: 'speech', voice: 'dialogue', text: '薯条……我好想要薯条……', placement: 'top-right', emphasis: 0.4, tail: 'character' }] },
      { art: 'Medium shot of KANTA the slim seagull standing up on the post, wing raised like a fist, determined shonen pose', bubbles: [{ type: 'shout', voice: 'dialogue', text: '别做梦了！想要就自己去拿！', placement: 'top-left', emphasis: 0.85, tail: 'character' }] },
      { art: 'KANTA drawing a battle plan map in the sand with a small stick, sketch of the fry stand and arrows, intense general face', bubbles: [{ type: 'speech', voice: 'dialogue', text: '作战计划：声东击西，我引开老板', placement: 'bottom-left', emphasis: 0.5, tail: 'character' }] },
      { art: 'POPPO saluting proudly with a tiny wing, chest puffed, confident silly grin', bubbles: [{ type: 'speech', voice: 'dialogue', text: '我负责吃！', placement: 'top-right', emphasis: 0.5, tail: 'character' }, { type: 'shout', voice: 'dialogue', text: '你负责掩护！！', placement: 'bottom-left', emphasis: 0.8, tail: 'character' }] },
    ],
  },
  {
    n: 2, scenario: 'action', desiredPanels: 6, rows: '2-4',
    mcp: { plot: 'The fry heist succeeds but a giant beach poster ambushes the seagulls', events: 'dash; chef chase; escape; poster ambush; crash; irony reveal', style: 'Dragon Ball style action comedy', dialogueDensity: 'balanced' },
    beats: [
      { art: 'KANTA dashing at supersonic speed low over the sand, extreme speed lines and afterimage trail', sfx: 'ゴゴゴ…' },
      { art: 'Fry stand chef swinging a giant spatula, KANTA ducking under the swing, fries flying everywhere, action impact frame', sfx: 'バシャーッ!' },
      { art: 'POPPO flying up into the sky clutching a paper pack of french fries, triumphant, KANTA flying beside him', bubbles: [{ type: 'shout', voice: 'dialogue', text: '拿到啦——！！', placement: 'top-right', emphasis: 0.9, tail: 'character' }] },
      { art: 'A huge beach advertising billboard with a blank white poster surface tearing loose in the wind, looming behind two small flying seagulls like a giant monster attack', sfx: 'ドンッ!!' },
      { art: 'The two seagulls flattened under the fallen giant billboard, only their little legs sticking out from the edge, comedic devastation', bubbles: [{ type: 'whisper', voice: 'dialogue', text: '……薯条……还好吗……', placement: 'bottom-right', emphasis: 0.35, tail: 'none' }] },
      { art: 'Close-up of the fallen billboard: a blank white advertising board, dramatic low angle, tiny seagull feathers drifting', overlay: { text: '薯条半价!' }, caption: '偷袭他们的海报，写的竟然是——' },
    ],
  },
  {
    n: 3, scenario: 'climax', desiredPanels: 6, rows: '2-4',
    mcp: { plot: 'Traumatized seagulls vow never to steal fries again, then a third seagull casually buys fries at the convenience store', events: 'limp home; dramatic vow; store door opens; casual seagull; jaw drop; punchline', style: 'Dragon Ball style action comedy', dialogueDensity: 'balanced' },
    beats: [
      { art: 'The two seagulls limping back, feathers scorched and messy, tiny bandages, dramatic exhausted poses at sunset', bubbles: [{ type: 'speech', voice: 'dialogue', text: '我们差一点……就为了薯条献出生命……', placement: 'top-right', emphasis: 0.5, tail: 'character' }] },
      { art: 'Extreme close-up of the two seagulls with teary sparkle eyes raising wings together in a dramatic oath', bubbles: [{ type: 'speech', voice: 'dialogue', text: '从今往后……再也不抢薯条了……', placement: 'top-left', emphasis: 0.6, tail: 'character' }, { type: 'speech', voice: 'dialogue', text: '发誓。', placement: 'bottom-left', emphasis: 0.5, tail: 'character' }] },
      { art: 'A convenience store automatic door sliding open with dramatic heavenly light rays, low angle, empty storefront glow', sfx: 'チャリーン♪' },
      { art: 'A third casual seagull with half-lidded relaxed eyes strolling out of the store holding a pack of french fries in its beak, totally unbothered', sfx: 'てくてく…' },
      { art: 'Huge close-up of the two seagulls in exaggerated cartoon shock, jaws stretched impossibly long dropping to the ground, eyes popping out, classic manga gag', sfx: 'ポカーン!!' },
      { art: 'The casual third seagull walking past the two shocked seagulls, fries in beak, giving them a relaxed side glance', bubbles: [{ type: 'speech', voice: 'dialogue', text: '……为什么要抢？便利店直接买不就好了。', placement: 'top-right', emphasis: 0.4, tail: 'character' }], caption: '完' },
    ],
  },
]
const FILLER_ART = 'Quiet scenic panel: gentle ocean waves, beach sky, a few drifting seagull feathers, calm mood'

// ---------- MCP: select_best_layout per page ----------
function pageConfig(page) {
  const [rowMin, rowMax] = page.rows.split('-').map(Number)
  return { ratio: 0.708, rowMin, rowMax, tilt: 0.25, bleed: 0.2, nest: 0.12, big: 0.16 }
}
async function selectLayoutViaMcp(page) {
  const config = pageConfig(page)
  let best = null
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const candidates = Array.from({ length: 12 }, (_, i) => {
      const layout = generate(`${page.n}page-try${attempt}#${i + 1}`, config)
      return { index: i, panelCount: layout.panels.length, seed: layout.seed, ratio: layout.width / layout.height, mode: 'standard', ...layoutDecisionFeatures(layout) }
    })
    const body = { jsonrpc: '2.0', id: page.n, method: 'tools/call', params: { name: 'select_best_layout', arguments: { desiredPanels: page.desiredPanels, ...page.mcp, candidates } } }
    const response = await fetch(`${WORKER}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    const dataLine = text.split('\n').reverse().find((l) => l.startsWith('data: '))
    if (!dataLine) throw new Error(`MCP no data for page ${page.n}: ${text.slice(0, 200)}`)
    const json = JSON.parse(dataLine.slice(6))
    const result = JSON.parse(json.result.content[0].text)
    const chosen = candidates[result.selectedLayoutIndex] || candidates[0]
    const pick = { layout: generate(chosen.seed, config), chosen, mcpResult: result }
    console.log(`page ${page.n} try${attempt}: MCP picked #${result.selectedLayoutIndex} panels=${chosen.panelCount} scenario=${result.scenario} conf=${result.confidence}`)
    if (!best || Math.abs(chosen.panelCount - page.beats.length) < Math.abs(best.chosen.panelCount - page.beats.length)) best = pick
    if (chosen.panelCount === page.beats.length) { best = pick; break }
  }
  if (best.chosen.panelCount !== page.beats.length) console.log(`page ${page.n}: no exact panel count after retries (best ${best.chosen.panelCount})`)
  return best
}
async function generatePanelImage(filePath, prompt) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${OR_KEY}` },
        body: JSON.stringify({ model: IMAGE_MODEL, modalities: ['image', 'text'], messages: [{ role: 'user', content: prompt }] }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 150)}`)
      const json = await response.json()
      const dataUrl = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url
      if (!dataUrl) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 150)}`)
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
      return
    } catch (error) {
      console.log(`  retry ${attempt} for ${path.basename(filePath)}: ${error.message}`)
      if (attempt === 3) throw error
      await new Promise((r) => setTimeout(r, 5000 * attempt))
    }
  }
}
async function runPool(items, worker, size = 6) {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) { const item = queue.shift(); await worker(item) }
  })
  await Promise.all(runners)
}

// ---------- SVG composition (bubble renderer ported from src/App.vue) ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
function panelBounds(panel) {
  const xs = panel.pts.map((p) => p[0]), ys = panel.pts.map((p) => p[1])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}
function textLines(text, maxChars) {
  const chars = Array.from(String(text || '').trim())
  const lines = []
  for (let i = 0; i < chars.length; i += maxChars) lines.push(chars.slice(i, i + maxChars).join(''))
  return lines.slice(0, 5)
}
function bubbleMarkup(panel, bubble, panelW) {
  const b = panelBounds(panel)
  const pw = b.maxX - b.minX, ph = b.maxY - b.minY
  const width = Math.max(80, Math.min(pw * 0.72, 200))
  const maxChars = Math.max(7, Math.floor(width / 15))
  const lines = textLines(bubble.text, maxChars)
  if (!lines.length) return ''
  const height = Math.max(36, Math.min(ph * 0.3, 24 + lines.length * 17))
  const pos = {
    'top-left': [b.minX + pw * 0.27, b.minY + ph * 0.2], 'top-right': [b.maxX - pw * 0.27, b.minY + ph * 0.2],
    center: [(b.minX + b.maxX) / 2, b.minY + ph * 0.48],
    'bottom-left': [b.minX + pw * 0.27, b.maxY - ph * 0.22], 'bottom-right': [b.maxX - pw * 0.27, b.maxY - ph * 0.22],
  }
  const [cxRaw, cyRaw] = pos[bubble.placement] || pos['top-right']
  const stroke = bubble.emphasis >= 0.72 ? '#B52B37' : '#1E78C8'
  const sw = bubble.emphasis >= 0.72 ? 3.5 : 2.5
  const rx = width / 2, ry = height / 2
  const cx = Math.min(Math.max(cxRaw, 10 + rx * 0.8), 698 - rx * 0.8)
  const cy = Math.min(Math.max(cyRaw, 10 + ry * 0.8), 990 - ry * 0.8)
  let shape = ''
  if (bubble.type === 'caption') {
    shape = `<rect x="${(cx - rx).toFixed(1)}" y="${(cy - ry).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="6" fill="#FFF" fill-opacity=".92" stroke="${stroke}" stroke-width="${sw}"/>`
  } else if (bubble.type === 'shout' || bubble.type === 'sfx') {
    const points = Array.from({ length: 16 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 16
      return `${(cx + Math.cos(a) * (i % 2 ? rx * .84 : rx)).toFixed(1)},${(cy + Math.sin(a) * (i % 2 ? ry * .84 : ry)).toFixed(1)}`
    }).join(' ')
    shape = `<polygon points="${points}" fill="#FFF" fill-opacity=".92" stroke="${stroke}" stroke-width="${sw}"/>`
  } else {
    const dash = bubble.type === 'whisper' ? ' stroke-dasharray="7 5"' : ''
    shape = `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#FFF" fill-opacity=".92" stroke="${stroke}" stroke-width="${sw}"${dash}/>`
    if (bubble.type === 'thought') shape += `<circle cx="${(cx - rx * .42).toFixed(1)}" cy="${(cy + ry * 1.25).toFixed(1)}" r="5" fill="#FFF" stroke="${stroke}" stroke-width="2"/><circle cx="${(cx - rx * .55).toFixed(1)}" cy="${(cy + ry * 1.52).toFixed(1)}" r="3" fill="#FFF" stroke="${stroke}" stroke-width="2"/>`
    else if (bubble.tail !== 'none') shape += `<polygon points="${(cx - rx * .18).toFixed(1)},${(cy + ry * .7).toFixed(1)} ${(cx + rx * .02).toFixed(1)},${(cy + ry * .58).toFixed(1)} ${(cx - rx * .28).toFixed(1)},${(cy + ry * 1.1).toFixed(1)}" fill="#FFF" stroke="${stroke}" stroke-width="2"/>`
  }
  const fontSize = Math.max(10, Math.min(17, width / (Math.max(...lines.map((l) => l.length)) * 1.05)))
  const startY = cy - ((lines.length - 1) * fontSize * .6)
  const text = `<text x="${cx.toFixed(1)}" y="${startY.toFixed(1)}" text-anchor="middle" font-family="'Noto Sans CJK SC','PingFang SC','Microsoft YaHei',Arial,sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="${bubble.emphasis >= 0.72 ? 700 : 500}" fill="#111">${lines.map((l, i) => `<tspan x="${cx.toFixed(1)}" dy="${i ? (fontSize * 1.2).toFixed(1) : 0}">${esc(l)}</tspan>`).join('')}</text>`
  return shape + text
}
function sfxMarkup(panel, text) {
  const b = panelBounds(panel)
  const cx = (b.minX + b.maxX) / 2, cy = b.minY + (b.maxY - b.minY) * 0.32
  const size = Math.max(24, Math.min(44, (b.maxX - b.minX) / Math.max(5, text.length) * 1.6))
  return `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" transform="rotate(-10 ${cx.toFixed(1)} ${cy.toFixed(1)})" font-family="'Noto Sans CJK JP','Yu Gothic','Hiragino Kaku Gothic Pro',Arial,sans-serif" font-size="${size.toFixed(1)}" font-weight="900" fill="#111" stroke="#FFF" stroke-width="5" paint-order="stroke" letter-spacing="2">${esc(text)}</text>`
}
function captionMarkup(panel, text) {
  const b = panelBounds(panel)
  const size = 15
  const rectX = Math.max(10, b.minX + 6)
  const rectY = Math.max(10, b.minY + (b.maxY - b.minY) * 0.12 - size)
  const rectW = Math.min(b.maxX - rectX - 6, text.length * size * 1.05 + 16)
  return `<rect x="${rectX.toFixed(1)}" y="${rectY.toFixed(1)}" width="${rectW.toFixed(1)}" height="${(size + 12).toFixed(1)}" fill="#FFF" fill-opacity=".92" stroke="#101417" stroke-width="2"/><text x="${(rectX + 8).toFixed(1)}" y="${(rectY + size).toFixed(1)}" font-family="'Noto Sans CJK SC',Arial,sans-serif" font-size="${size}" font-weight="700" fill="#111">${esc(text)}</text>`
}
function composePageSvg(page, layout, panelFiles) {
  const count = Math.min(layout.panels.length, panelFiles.length)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}"><rect width="${layout.width}" height="${layout.height}" fill="#fff"/><defs>`
  for (let i = 0; i < count; i += 1) svg += `<clipPath id="cp${page.n}-${i}"><polygon points="${layout.panels[i].pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}"/></clipPath>`
  svg += '</defs>'
  for (let i = 0; i < count; i += 1) {
    const b = panelBounds(layout.panels[i])
    svg += `<g clip-path="url(#cp${page.n}-${i})"><image href="${panelFiles[i]}" x="${b.minX.toFixed(1)}" y="${b.minY.toFixed(1)}" width="${(b.maxX - b.minX).toFixed(1)}" height="${(b.maxY - b.minY).toFixed(1)}" preserveAspectRatio="xMidYMid slice"/></g>`
    svg += `<polygon points="${layout.panels[i].pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="none" stroke="#101417" stroke-width="4" stroke-linejoin="miter"/>`
  }
  for (let i = 0; i < count; i += 1) {
    const beat = page.beats[i]
    if (!beat) continue
    for (const [j, bubble] of (beat.bubbles || []).entries()) svg += bubbleMarkup(layout.panels[i], { ...bubble }, layout.width)
    if (beat.sfx) svg += sfxMarkup(layout.panels[i], beat.sfx)
    if (beat.caption) svg += captionMarkup(layout.panels[i], beat.caption)
    if (beat.overlay) {
      const b = panelBounds(layout.panels[i])
      const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2
      svg += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" transform="rotate(-8 ${cx.toFixed(1)} ${cy.toFixed(1)})" font-family="'Noto Sans CJK SC',Arial,sans-serif" font-size="34" font-weight="900" fill="#C62828" stroke="#FFF" stroke-width="6" paint-order="stroke">${esc(beat.overlay.text)}</text>`
    }
  }
  svg += `<text x="${(layout.width / 2).toFixed(0)}" y="${layout.height - 22}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#555">海鸥薯条大作战 · ${page.n} / 3</text>`
  return svg + '</svg>'
}

// ---------- main ----------
const jobs = []
const pages = []
for (const page of PAGES) {
  const { layout } = await selectLayoutViaMcp(page)
  let beats = page.beats.slice(0, layout.panels.length)
  while (beats.length < layout.panels.length) {
    console.log(`page ${page.n}: layout has ${layout.panels.length} panels, padding beat ${beats.length + 1}`)
    beats.push({ art: FILLER_ART })
  }
  if (page.beats.length !== layout.panels.length) console.log(`page ${page.n}: NOTE wanted ${page.beats.length} beats, layout has ${layout.panels.length} panels`)
  const panelFiles = beats.map((beat, i) => {
    const file = `panels/p${page.n}-${i + 1}.png`
    const b = panelBounds(layout.panels[i])
    const w = b.maxX - b.minX, h = b.maxY - b.minY
    const aspect = w > h * 1.3 ? 'Wide horizontal composition.' : h > w * 1.3 ? 'Tall vertical composition.' : 'Balanced composition.'
    jobs.push({ file: path.join(DIR, file), prompt: `${beat.art}. ${aspect} ${CHAR_SHEET}`, cached: fs.existsSync(path.join(DIR, file)) })
    return file
  })
  pages.push({ page, layout, beats, panelFiles })
}
const todo = jobs.filter((job) => !job.cached)
console.log(`${jobs.length} panels total, ${jobs.length - todo.length} cached, generating ${todo.length} with ${IMAGE_MODEL}...`)
await runPool(todo, async (job) => {
  await generatePanelImage(job.file, job.prompt)
  console.log(`done ${path.basename(job.file)}`)
}, 6)
for (const { page, layout, panelFiles } of pages) {
  const svg = composePageSvg(page, layout, panelFiles)
  fs.writeFileSync(path.join(DIR, `page-${page.n}.svg`), svg)
  console.log(`wrote page-${page.n}.svg (${layout.panels.length} panels)`)
}
console.log('ALL DONE')
