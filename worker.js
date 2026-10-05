import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { z } from 'zod'

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast'
const ALLOWED_MODELS = new Set([
  '@cf/meta/llama-3.1-8b-instruct-fast',
])

const EMOTIONAL_TIPS = {
  ja: {
    tension: {
      title: '緊張・圧迫',
      tips: ['余白を狭め、視線を逃がさない縦長コマを混ぜる', '台詞を短くして、無言のコマを直前に置く', '水平線を少し崩し、読者の足場をわずかに不安定にする'],
    },
    relief: {
      title: '安堵・解放',
      tips: ['大きなコマを一つ置き、視線が休める呼吸を作る', '背景を広く見せて、人物の周囲に空気を残す', '角の少ない水平分割で速度を落とす'],
    },
    intimacy: {
      title: '親密・静けさ',
      tips: ['小さめのコマを会話のリズムとして連ねる', '目線の高さを揃えて、二人の距離を一定に保つ', '吹き出しを内側に寄せ、コマ間の余白を声の間にする'],
    },
    shock: {
      title: '衝撃・転換',
      tips: ['見開きに近い大ゴマを突然差し込む', '直前は情報を抑え、次のコマで輪郭を一気に開く', '斜めの境界線は一度だけ使い、瞬間の異常を強調する'],
    },
  },
  en: {
    tension: { title: 'Tension / pressure', tips: ['Tighten the margins and mix in a tall panel that traps the eye.', 'Shorten dialogue and place a silent panel immediately before the line.', 'Slightly break the horizon so the reader loses a stable footing.'] },
    relief: { title: 'Relief / release', tips: ['Give the eye one large panel where it can breathe.', 'Open the background around the subject and leave visible air.', 'Use calmer horizontal divisions to slow the reading pace.'] },
    intimacy: { title: 'Intimacy / quiet', tips: ['Chain smaller panels into a conversational rhythm.', 'Keep both eye-lines at a shared height to hold their distance.', 'Pull bubbles inward and let the gutter become the pause between voices.'] },
    shock: { title: 'Shock / turn', tips: ['Drop in a near-splash panel without warning.', 'Withhold information just before the reveal, then open the silhouette wide.', 'Use one diagonal boundary only; reserve it for the moment reality tilts.'] },
  },
  zh: {
    tension: { title: '紧张 / 压迫', tips: ['收紧边距，混入纵向长格，让视线无处逃开。', '缩短对白，在对白前放置一个无声格。', '轻微打破水平线，让读者失去稳定的落脚点。'] },
    relief: { title: '释然 / 释放', tips: ['安排一个大格，让视线有可以呼吸的空间。', '打开人物周围的背景，保留可见的空气感。', '使用更平缓的横向分割，放慢阅读节奏。'] },
    intimacy: { title: '亲密 / 安静', tips: ['用较小的格子串起对话节奏。', '保持两人的视线高度一致，稳定他们之间的距离。', '把气泡收向格内，让格间成为声音之间的停顿。'] },
    shock: { title: '冲击 / 转折', tips: ['突然插入接近满版的关键大格。', '在揭示前收住信息，在下一格突然打开轮廓。', '只使用一次斜线边界，把它留给现实倾斜的瞬间。'] },
  },
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders() },
  })
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, mcp-session-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  }
}

function clean(value, fallback = '', max = 4000) {
  return String(value ?? fallback).trim().slice(0, max)
}

function normalizeInput(input = {}) {
  return {
    language: ['ja', 'en', 'zh'].includes(input.language) ? input.language : 'en',
    title: clean(input.title, 'Untitled sequence', 160),
    world: clean(input.world, 'A world with a clear visual identity and social rules'),
    chapter: clean(input.chapter, 'The chapter begins just before a consequential choice'),
    plot: clean(input.plot, 'A character wants something, but the situation changes before they can act'),
    events: clean(input.events, 'Inciting event; escalation; reversal; consequence', 3000),
    setting: clean(input.setting, 'Location, time of day, weather, and atmosphere'),
    characters: clean(input.characters, 'Describe the point-of-view character and the opposing force', 2400),
    style: clean(input.style, 'Readable manga staging with intentional rhythm', 1200),
    desiredPanels: Math.min(24, Math.max(3, Number(input.desiredPanels) || 6)),
    dialogueDensity: ['none', 'light', 'balanced', 'dense'].includes(input.dialogueDensity) ? input.dialogueDensity : 'balanced',
    promptTemplate: clean(input.promptTemplate, '', 7000),
    temperature: Math.min(1, Math.max(0, Number(input.temperature) || 0.55)),
    maxTokens: Math.min(3200, Math.max(600, Number(input.maxTokens) || 1800)),
    model: ALLOWED_MODELS.has(input.model) ? input.model : DEFAULT_MODEL,
    candidates: Array.isArray(input.candidates) ? input.candidates.slice(0, 48).map((candidate, index) => ({
      index: Number.isInteger(candidate.index) ? candidate.index : index,
      panelCount: Number(candidate.panelCount) || 0,
      seed: clean(candidate.seed, '', 120),
      ratio: Number(candidate.ratio) || 0.708,
      mode: clean(candidate.mode, 'standard', 80),
    })) : [],
  }
}

function languageName(language) {
  return language === 'ja' ? 'Japanese' : language === 'zh' ? 'Simplified Chinese' : 'English'
}

function buildStoryboardPrompt(input) {
  const candidates = input.candidates.length
    ? JSON.stringify(input.candidates)
    : '[{"index":0,"panelCount":6,"seed":"fallback","ratio":0.708,"mode":"standard"}]'
  const template = input.promptTemplate || 'Choose the strongest layout for the emotional rhythm, then write a precise production prompt for every panel.'
  return `You are a senior manga storyboard director and layout decision model. Return ONLY valid JSON, with no markdown fences.

LANGUAGE: ${languageName(input.language)}
TITLE: ${input.title}
WORLD / CHAPTER SETTING: ${input.world}
CHAPTER: ${input.chapter}
KEY PLOT: ${input.plot}
KEY EVENTS: ${input.events}
SETTING DETAILS: ${input.setting}
CHARACTERS: ${input.characters}
VISUAL STYLE: ${input.style}
DESIRED PANELS: ${input.desiredPanels}
DIALOGUE DENSITY: ${input.dialogueDensity}
USER PROMPT TEMPLATE: ${template}
CANDIDATE LAYOUTS: ${candidates}

Decision task:
1. Evaluate each candidate against the plot's pacing, emotional turn, panel count, and readability.
2. Choose exactly one candidate index as selectedLayoutIndex. Prefer a layout that gives the turning point the strongest scale contrast while preserving right-to-left, top-to-bottom manga reading order.
3. Write one-sentence reasoning and a short sequence summary.
4. Return exactly ${input.desiredPanels} story boxes unless the selected candidate has fewer panels; then return one box per selected panel.
5. Every story box must contain: panelNumber, beat, shot, action, dialogue, emotion, background, camera, and prompt.
6. Each prompt must be directly usable by an illustrator or image model: subject, action, facial/body performance, camera/framing, environment, lighting, continuity, and negative constraints. Never invent named facts not present in the context.

JSON shape:
{
  "selectedLayoutIndex": 0,
  "decisionModel": "${input.model}",
  "reasoning": "...",
  "summary": "...",
  "storyBoxes": [{
    "panelNumber": 1,
    "beat": "...",
    "shot": "...",
    "action": "...",
    "dialogue": "...",
    "emotion": "...",
    "background": "...",
    "camera": "...",
    "prompt": "..."
  }]
}`
}

function extractJson(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  return JSON.parse(candidate)
}

function fallbackStoryboard(input) {
  const selected = input.candidates.length
    ? input.candidates.reduce((best, candidate) => {
      const bestDistance = Math.abs(best.panelCount - input.desiredPanels)
      const candidateDistance = Math.abs(candidate.panelCount - input.desiredPanels)
      return candidateDistance < bestDistance ? candidate : best
    }, input.candidates[0])
    : { index: 0, panelCount: input.desiredPanels, seed: 'fallback' }
  const count = selected.panelCount || input.desiredPanels
  const beats = ['Establish the situation', 'Introduce pressure', 'Force a choice', 'Escalate the cost', 'Reveal the turn', 'Land the consequence']
  return {
    selectedLayoutIndex: selected.index,
    selectedSeed: selected.seed,
    decisionModel: 'deterministic-fallback',
    reasoning: 'The AI binding was unavailable, so the closest panel-count candidate was selected to preserve the requested pacing.',
    summary: `${input.title}: ${input.plot}`,
    storyBoxes: Array.from({ length: count }, (_, index) => ({
      panelNumber: index + 1,
      beat: beats[index % beats.length],
      shot: index % 3 === 0 ? 'wide establishing shot' : index % 3 === 1 ? 'medium interaction shot' : 'close-up reaction',
      action: index === count - 1 ? 'Hold on the consequence and leave a visual hook for the next beat.' : 'Advance the action without adding a new plot fact.',
      dialogue: input.dialogueDensity === 'none' ? '' : index % 2 === 0 ? 'A short line that clarifies intent.' : 'Let the image carry the beat; keep dialogue minimal.',
      emotion: index < count / 2 ? 'anticipation' : 'resolve',
      background: input.setting,
      camera: index % 3 === 0 ? 'wide, eye-level' : index % 3 === 1 ? 'medium, over-shoulder' : 'tight close-up',
      prompt: `Manga storyboard panel ${index + 1}; ${beats[index % beats.length]}; ${input.characters}; ${input.setting}; ${input.style}; preserve right-to-left reading order, clear silhouettes, intentional negative space, no text rendering artifacts.`,
    })),
  }
}

function normalizeResult(raw, input) {
  const fallback = fallbackStoryboard(input)
  const result = raw && typeof raw === 'object' ? raw : {}
  const selectedLayoutIndex = Number.isInteger(result.selectedLayoutIndex) ? result.selectedLayoutIndex : fallback.selectedLayoutIndex
  const boxes = Array.isArray(result.storyBoxes) ? result.storyBoxes : []
  return {
    selectedLayoutIndex,
    selectedSeed: input.candidates.find((candidate) => candidate.index === selectedLayoutIndex)?.seed || fallback.selectedSeed,
    decisionModel: clean(result.decisionModel, input.model, 120),
    reasoning: clean(result.reasoning, fallback.reasoning, 1200),
    summary: clean(result.summary, fallback.summary, 1600),
    storyBoxes: (boxes.length ? boxes : fallback.storyBoxes).slice(0, 24).map((box, index) => ({
      panelNumber: Number(box.panelNumber) || index + 1,
      beat: clean(box.beat, fallback.storyBoxes[index % fallback.storyBoxes.length].beat, 500),
      shot: clean(box.shot, 'medium shot', 260),
      action: clean(box.action, 'Advance the story beat.', 700),
      dialogue: clean(box.dialogue, '', 600),
      emotion: clean(box.emotion, 'focused', 220),
      background: clean(box.background, input.setting, 700),
      camera: clean(box.camera, 'eye-level', 260),
      prompt: clean(box.prompt, fallback.storyBoxes[index % fallback.storyBoxes.length].prompt, 1800),
    })),
  }
}

async function generateStoryboard(input, env) {
  const normalized = normalizeInput(input)
  if (!env.AI) return fallbackStoryboard(normalized)
  try {
    const response = await env.AI.run(normalized.model, {
      prompt: buildStoryboardPrompt(normalized),
      temperature: normalized.temperature,
      max_tokens: normalized.maxTokens,
    })
    const raw = extractJson(response?.response ?? response)
    return normalizeResult(raw, normalized)
  } catch (error) {
    return { ...fallbackStoryboard(normalized), aiError: clean(error?.message, 'Workers AI unavailable', 280) }
  }
}

function emotionalTips(language, emotion, scene = '') {
  const locale = EMOTIONAL_TIPS[language] || EMOTIONAL_TIPS.en
  const tip = locale[emotion] || locale.tension
  return {
    emotion,
    title: tip.title,
    scene: clean(scene, 'Use this as a compositional direction, not a fixed rule.', 500),
    tips: tip.tips,
    source: 'curated-layout-guidance',
  }
}

function createServer(env) {
  const server = new McpServer({ name: 'manga-layout-agent', version: '0.1.0' })
  server.registerTool('generate_storyboard', {
    description: 'Choose the strongest manga panel layout for a story context and return production-ready prompts for every story box.',
    inputSchema: {
      language: z.enum(['ja', 'en', 'zh']).optional(),
      title: z.string().optional(),
      world: z.string().optional(),
      chapter: z.string().optional(),
      plot: z.string().optional(),
      events: z.string().optional(),
      setting: z.string().optional(),
      characters: z.string().optional(),
      style: z.string().optional(),
      desiredPanels: z.number().optional(),
      dialogueDensity: z.enum(['none', 'light', 'balanced', 'dense']).optional(),
      promptTemplate: z.string().optional(),
      candidates: z.array(z.object({ index: z.number(), panelCount: z.number(), seed: z.string().optional(), ratio: z.number().optional(), mode: z.string().optional() })).optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(await generateStoryboard(args, env)) }],
  }))
  server.registerTool('get_emotional_tips', {
    description: 'Return varied manga composition guidance for an emotional beat.',
    inputSchema: { language: z.enum(['ja', 'en', 'zh']).optional(), emotion: z.enum(['tension', 'relief', 'intimacy', 'shock']), scene: z.string().optional() },
  }, async ({ language = 'en', emotion = 'tension', scene = '' }) => ({
    content: [{ type: 'text', text: JSON.stringify(emotionalTips(language, emotion, scene)) }],
  }))
  server.registerTool('select_best_layout', {
    description: 'Select the closest layout candidate for a requested story rhythm when an LLM is not required.',
    inputSchema: { desiredPanels: z.number(), candidates: z.array(z.object({ index: z.number(), panelCount: z.number(), seed: z.string().optional() })) },
  }, async ({ desiredPanels, candidates }) => {
    const choice = candidates.reduce((best, candidate) => Math.abs(candidate.panelCount - desiredPanels) < Math.abs(best.panelCount - desiredPanels) ? candidate : best, candidates[0])
    return { content: [{ type: 'text', text: JSON.stringify({ selectedLayoutIndex: choice?.index ?? 0, selectedSeed: choice?.seed ?? '', reason: 'Closest panel-count fit.' }) }] }
  })
  return server
}

async function parseJson(request) {
  try { return await request.json() } catch { return {} }
}

async function handleRest(request, env, pathname) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
  if (pathname === '/api/health' && request.method === 'GET') return jsonResponse({ ok: true, service: 'manga-layout-agent', ai: Boolean(env.AI), model: DEFAULT_MODEL })
  if (pathname === '/api/storyboard' && request.method === 'POST') return jsonResponse(await generateStoryboard(await parseJson(request), env))
  if (pathname === '/api/emotional-tips' && request.method === 'POST') {
    const body = await parseJson(request)
    return jsonResponse(emotionalTips(body.language || 'en', body.emotion || 'tension', body.scene || ''))
  }
  if (pathname === '/api/mcp/tools' && request.method === 'GET') return jsonResponse({ tools: [
    { name: 'generate_storyboard', description: 'Choose a layout and write prompts for each story box.' },
    { name: 'get_emotional_tips', description: 'Return varied emotional layout guidance.' },
    { name: 'select_best_layout', description: 'Choose the closest candidate by story rhythm.' },
  ] })
  return null
}

const mcpMetadata = {
  name: 'manga-layout-agent',
  version: '0.1.0',
  endpoint: '/mcp',
  transport: 'streamable-http',
  tools: ['generate_storyboard', 'get_emotional_tips', 'select_best_layout'],
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/.well-known/mcp.json' && request.method === 'GET') return jsonResponse(mcpMetadata)
    const rest = await handleRest(request, env, url.pathname)
    if (rest) return rest
    if (url.pathname === '/mcp') {
      if (request.method === 'GET') return jsonResponse({ ...mcpMetadata, message: 'Send MCP JSON-RPC requests with POST.' })
      return createMcpHandler(() => createServer(env), { route: '/mcp', responseMode: 'json' })(request, env, ctx)
    }
    return env.ASSETS.fetch(request)
  },
}
