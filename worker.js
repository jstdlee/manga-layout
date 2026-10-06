import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { z } from 'zod'

const DEFAULT_MODEL = '@cf/zai-org/glm-5.3-flash'
const ALLOWED_MODELS = new Set([
  '@cf/zai-org/glm-5.3-flash',
])
const AUTH_COOKIE = 'manga_layout_auth'
const AUTH_MAX_AGE = 60 * 60 * 24 * 7

const LAYOUT_KNOWLEDGE = {
  readability: 'Manga pages are read right-to-left, then top-to-bottom. Preserve a clear first-entry panel, stable eye flow, readable gutters, and a deliberate last panel.',
  hierarchy: 'Use scale contrast to control emphasis: small panels compress time or information; a large panel gives the reader a breath, reveal, emotional landing, or impact.',
  tension: 'Tension benefits from compression, repeated eye-level beats, narrow or tilted panels, and a controlled release rather than random fragmentation.',
  intimacy: 'Intimacy benefits from calm geometry, repeated shot scale, shared eye-lines, moderate panel count, and enough negative space for pauses.',
  action: 'Action benefits from varied panel sizes, directional diagonals, strong silhouettes, and a readable escalation toward a larger or cleaner impact beat.',
  reveal: 'A reveal should hide or compress information before the turn, then open the visual field in the reveal or consequence panel.',
  establishing: 'World and setting beats need an opening panel with enough area for geography, then progressively tighter panels for human detail.',
  climax: 'A climax needs a strong hierarchy: preparation panels should yield to one unmistakable peak panel, followed by a readable consequence.',
}

const DECISION_PROFILES = {
  tension: { keywords: ['tension', 'pressure', 'threat', 'danger', '恐怖', '緊張', '压迫', '危险'], idealPanels: [6, 10], hierarchy: 0.7, tilt: 0.55, rhythm: 0.8 },
  intimacy: { keywords: ['intimacy', 'quiet', 'conversation', 'confession', '親密', '会話', '安静', '对话'], idealPanels: [4, 8], hierarchy: 0.25, tilt: 0.1, rhythm: 0.75 },
  action: { keywords: ['fight', 'chase', 'battle', 'escape', 'impact', '戦闘', '追跡', '动作', '战斗', '追逐'], idealPanels: [6, 12], hierarchy: 0.65, tilt: 0.8, rhythm: 0.9 },
  reveal: { keywords: ['reveal', 'secret', 'shock', 'turn', 'truth', '反転', '衝撃', '秘密', '反转', '冲击'], idealPanels: [5, 9], hierarchy: 0.9, tilt: 0.45, rhythm: 0.8 },
  establishing: { keywords: ['worldbuilding', 'arrival', 'journey', 'landscape', 'geography', '到着', '旅', '世界观', '场景'], idealPanels: [4, 7], hierarchy: 0.65, tilt: 0.15, rhythm: 0.45 },
  climax: { keywords: ['climax', 'decision', 'sacrifice', 'consequence', '決断', '犠牲', '結末', '高潮', '决定', '后果'], idealPanels: [5, 9], hierarchy: 0.95, tilt: 0.5, rhythm: 0.85 },
  default: { keywords: [], idealPanels: [5, 8], hierarchy: 0.55, tilt: 0.35, rhythm: 0.65 },
}
const BUBBLE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['speech', 'thought', 'caption', 'whisper', 'shout', 'broadcast', 'sfx'] },
    voice: { type: 'string', enum: ['dialogue', 'monologue', 'narration', 'sound'] },
    text: { type: 'string' },
    placement: { type: 'string', enum: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'] },
    emphasis: { type: 'number' },
    tail: { type: 'string', enum: ['character', 'none'] },
  },
  required: ['type', 'voice', 'text', 'placement', 'emphasis', 'tail'],
}

const DECISION_ROUND_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['pass', 'refine'] },
    selectedLayoutIndex: { type: 'integer' },
    quality: { type: 'number' },
    confidence: { type: 'number' },
    reasoning: { type: 'string' },
    deficits: { type: 'array', items: { type: 'string' } },
    mutations: { type: 'array', items: { type: 'string' } },
    scores: {
      type: 'object',
      properties: {
        narrative: { type: 'number' },
        pacing: { type: 'number' },
        readingFlow: { type: 'number' },
        hierarchy: { type: 'number' },
        emotion: { type: 'number' },
        production: { type: 'number' },
      },
      required: ['narrative', 'pacing', 'readingFlow', 'hierarchy', 'emotion', 'production'],
    },
    rankedLayouts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          fit: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['index', 'fit', 'reason'],
      },
    },
  },
  required: ['status', 'selectedLayoutIndex', 'quality', 'confidence', 'reasoning', 'deficits', 'mutations', 'scores', 'rankedLayouts'],
}

const STORYBOARD_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    selectedLayoutIndex: { type: 'integer' },
    decisionModel: { type: 'string' },
    scenario: { type: 'string' },
    confidence: { type: 'number' },
    reasoning: { type: 'string' },
    summary: { type: 'string' },
    decisionRounds: { type: 'integer' },
    threshold: { type: 'number' },
    decisionTrace: { type: 'array', items: DECISION_ROUND_SCHEMA },
    rankedLayouts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          fit: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['index', 'fit', 'reason'],
      },
    },
    storyBoxes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          panelNumber: { type: 'integer' },
          beat: { type: 'string' },
          shot: { type: 'string' },
          action: { type: 'string' },
          dialogue: { type: 'string' },
          emotion: { type: 'string' },
          background: { type: 'string' },
          camera: { type: 'string' },
          prompt: { type: 'string' },
          bubbles: { type: 'array', items: BUBBLE_ITEM_SCHEMA },
        },
        required: ['panelNumber', 'beat', 'shot', 'action', 'dialogue', 'emotion', 'background', 'camera', 'prompt', 'bubbles'],
      },
    },
  },
  required: ['selectedLayoutIndex', 'decisionModel', 'scenario', 'confidence', 'reasoning', 'summary', 'decisionRounds', 'threshold', 'decisionTrace', 'rankedLayouts', 'storyBoxes'],
}


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
    'access-control-allow-headers': 'content-type, authorization, mcp-session-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  }
}

function clean(value, fallback = '', max = 4000) {
  return String(value ?? fallback).trim().slice(0, max)
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map((part) => {
    const separator = part.indexOf('=')
    return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())]
  }).filter(([key]) => key))
}

function bearerToken(request) {
  const value = request.headers.get('authorization') || ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : ''
}

async function tokenMatches(expected, provided) {
  if (!expected || !provided) return false
  const encoder = new TextEncoder()
  const [left, right] = await Promise.all([expected, provided].map((value) => crypto.subtle.digest('SHA-256', encoder.encode(value))))
  const a = new Uint8Array(left)
  const b = new Uint8Array(right)
  if (a.length !== b.length) return false
  return a.every((byte, index) => byte === b[index])
}

async function isAuthorized(request, env) {
  const expected = clean(env.ACCESS_TOKEN, '', 512)
  const provided = bearerToken(request) || parseCookies(request)[AUTH_COOKIE] || ''
  return tokenMatches(expected, provided)
}

function loginPage(message = '', status = message ? 401 : 200) {
  const safeMessage = message.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Manga Layout Login</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f4f0;color:#151719;font:16px system-ui,sans-serif}.card{width:min(420px,calc(100% - 32px));padding:28px;border:1px solid #d8d5cc;border-radius:14px;background:#fff;box-shadow:0 18px 50px #00000012}h1{margin:0 0 8px;font-size:24px}p{color:#686b70;line-height:1.5}label{display:grid;gap:8px;margin:22px 0 12px;color:#686b70;font-size:13px}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #bdb9ae;border-radius:8px;font:inherit}button{width:100%;padding:12px;border:0;border-radius:8px;background:#1e78c8;color:white;font:inherit;font-weight:700;cursor:pointer}.error{padding:10px;border-radius:8px;background:#fff1f1;color:#a32929}</style></head><body><main class="card"><p class="eyebrow">PANEL LAYOUT GACHA</p><h1>Manga Layout Generator</h1><p>Enter the access token to continue.</p>${safeMessage ? `<p class="error">${safeMessage}</p>` : ''}<form action="/auth/login" method="post"><label>Access token<input name="token" type="password" autocomplete="current-password" required autofocus></label><button type="submit">Continue</button></form></main></body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

async function handleAuth(request, env, pathname) {
  if (pathname === '/login' && request.method === 'GET') return loginPage()
  if (pathname === '/auth/login' && request.method === 'POST') {
    if (!clean(env.ACCESS_TOKEN)) return loginPage('Access token is not configured on this Worker.', 503)
    let token = ''
    if ((request.headers.get('content-type') || '').includes('application/json')) token = clean((await parseJson(request)).token, '', 512)
    else {
      try { token = clean((await request.formData()).get('token'), '', 512) } catch {}
    }
    if (!(await tokenMatches(env.ACCESS_TOKEN, token))) return loginPage('Invalid access token.')
    return new Response(null, {
      status: 303,
      headers: {
        location: '/',
        'set-cookie': `${AUTH_COOKIE}=${encodeURIComponent(token)}; Max-Age=${AUTH_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        'cache-control': 'no-store',
      },
    })
  }
  if (pathname === '/auth/logout' && (request.method === 'GET' || request.method === 'POST')) {
    return new Response(null, { status: 303, headers: { location: '/login', 'set-cookie': `${AUTH_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax` } })
  }
  return null
}

function unauthorizedResponse(request, pathname) {
  if (pathname.startsWith('/api/') || pathname === '/mcp' || pathname === '/.well-known/mcp.json') {
    return jsonResponse({ error: 'unauthorized', login: '/login' }, 401)
  }
  return Response.redirect(new URL('/login', request.url), 302)
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
    temperature: Math.min(1, Math.max(0, Number.isFinite(Number(input.temperature)) ? Number(input.temperature) : 0.35)),
    maxTokens: Math.min(3200, Math.max(600, Number(input.maxTokens) || 1800)),
    decisionRounds: Math.min(3, Math.max(1, Number(input.decisionRounds) || 2)),
    decisionThreshold: Math.min(0.98, Math.max(0.6, Number(input.decisionThreshold) || 0.82)),
    model: ALLOWED_MODELS.has(input.model) ? input.model : DEFAULT_MODEL,
    candidates: Array.isArray(input.candidates) ? input.candidates.slice(0, 48).map((candidate, index) => ({
      index: Number.isInteger(candidate.index) ? candidate.index : index,
      panelCount: Number(candidate.panelCount) || 0,
      seed: clean(candidate.seed, '', 120),
      ratio: Number(candidate.ratio) || 0.708,
      mode: clean(candidate.mode, 'standard', 80),
      rowCount: Math.max(1, Number(candidate.rowCount) || 1),
      largestPanelShare: Math.min(1, Math.max(0, Number(candidate.largestPanelShare) || 0)),
      smallestPanelShare: Math.min(1, Math.max(0, Number(candidate.smallestPanelShare) || 0)),
      firstPanelShare: Math.min(1, Math.max(0, Number(candidate.firstPanelShare) || 0)),
      lastPanelShare: Math.min(1, Math.max(0, Number(candidate.lastPanelShare) || 0)),
      hierarchy: Math.min(1, Math.max(0, Number(candidate.hierarchy) || 0)),
      tilt: Math.min(1, Math.max(0, Number(candidate.tilt) || 0)),
      nestedPanels: Math.max(0, Number(candidate.nestedPanels) || 0),
      bleedEdges: Math.max(0, Number(candidate.bleedEdges) || 0),
    })) : [],
  }
}

function languageName(language) {
  return language === 'ja' ? 'Japanese' : language === 'zh' ? 'Simplified Chinese' : 'English'
}

function scenarioProfile(input) {
  const text = [input.world, input.chapter, input.plot, input.events, input.setting, input.style, input.dialogueDensity].join(' ').toLowerCase()
  const matches = Object.entries(DECISION_PROFILES)
    .filter(([key]) => key !== 'default')
    .map(([key, profile]) => ({ key, hits: profile.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits)
  const primary = matches[0]?.key || 'default'
  const secondary = matches[1]?.key || null
  return {
    primary,
    secondary,
    signals: matches.slice(0, 3).map((item) => item.key),
    profile: DECISION_PROFILES[primary],
  }
}

function rangeFit(value, range) {
  if (value >= range[0] && value <= range[1]) return 1
  const distance = value < range[0] ? range[0] - value : value - range[1]
  return Math.max(0, 1 - distance / Math.max(1, range[1] - range[0] + 2))
}

function layoutScore(candidate, input, decision) {
  const profile = decision.profile
  const panelFit = 1 - Math.min(1, Math.abs(candidate.panelCount - input.desiredPanels) / Math.max(3, input.desiredPanels))
  const scenarioPanelFit = rangeFit(candidate.panelCount, profile.idealPanels)
  const hierarchyFit = 1 - Math.min(1, Math.abs(candidate.hierarchy - profile.hierarchy))
  const tiltFit = 1 - Math.min(1, Math.abs(candidate.tilt - profile.tilt))
  const readability = Math.max(0, 1 - Math.max(0, candidate.panelCount - 12) * 0.055 - Math.max(0, 0.025 - candidate.smallestPanelShare) * 8)
  const focus = decision.primary === 'reveal' || decision.primary === 'climax'
    ? Math.min(1, candidate.lastPanelShare * 1.8 + candidate.largestPanelShare * 0.55)
    : decision.primary === 'establishing'
      ? Math.min(1, candidate.firstPanelShare * 1.7 + candidate.largestPanelShare * 0.45)
      : 1
  const rhythm = decision.primary === 'intimacy'
    ? Math.max(0, 1 - candidate.hierarchy * 0.7 - candidate.tilt * 0.5)
    : Math.min(1, candidate.hierarchy * 0.7 + candidate.tilt * 0.4 + (candidate.nestedPanels > 0 ? 0.12 : 0))
  const score = Math.round((panelFit * 0.28 + scenarioPanelFit * 0.18 + hierarchyFit * 0.18 + tiltFit * 0.12 + readability * 0.12 + focus * 0.07 + rhythm * 0.05) * 1000) / 1000
  const reasons = []
  if (panelFit >= 0.8) reasons.push('matches requested panel count')
  if (profile.hierarchy >= 0.7 && candidate.hierarchy >= 0.45) reasons.push('has a clear impact hierarchy')
  if (profile.hierarchy <= 0.35 && candidate.hierarchy <= 0.55) reasons.push('keeps a calm, conversational scale')
  if (profile.tilt >= 0.6 && candidate.tilt >= 0.2) reasons.push('supports kinetic directional energy')
  if (profile.tilt <= 0.2 && candidate.tilt <= 0.45) reasons.push('protects stable readability')
  if (focus >= 0.7) reasons.push('gives the turn a strong entry or landing')
  return { score, reasons: reasons.slice(0, 3).join('; ') || 'balanced rhythm and readability' }
}

function rankCandidates(input) {
  const decision = scenarioProfile(input)
  const ranked = input.candidates.map((candidate) => {
    const result = layoutScore(candidate, input, decision)
    return { ...candidate, heuristicScore: result.score, heuristicReason: result.reasons }
  }).sort((a, b) => b.heuristicScore - a.heuristicScore || Math.abs(a.panelCount - input.desiredPanels) - Math.abs(b.panelCount - input.desiredPanels))
  return { decision, ranked, shortlist: ranked.slice(0, 12) }
}


function buildDecisionPrompt(input, ranking, round, previous) {
  const pool = round === 1 ? ranking.shortlist : ranking.ranked.slice(0, 24)
  const candidates = pool.length ? JSON.stringify(pool) : '[{"index":0,"panelCount":6,"heuristicScore":0.5,"heuristicReason":"fallback candidate"}]'
  const profile = ranking.decision
  return `You are the CF-JEV manga layout judge: Judge, Evaluate, Verify. Do not write the storyboard yet. Return only JSON.

ROUND: ${round}/${input.decisionRounds}
LANGUAGE: ${languageName(input.language)}
WORLD: ${input.world}
CHAPTER: ${input.chapter}
PLOT: ${input.plot}
EVENTS: ${input.events}
SETTING: ${input.setting}
CHARACTERS: ${input.characters}
STYLE: ${input.style}
TARGET PANELS: ${input.desiredPanels}
DIALOGUE DENSITY: ${input.dialogueDensity}
SCENARIO: primary=${profile.primary}; secondary=${profile.secondary || 'none'}
THRESHOLD: ${input.decisionThreshold}

MANGA DECISION RULES:
- ${LAYOUT_KNOWLEDGE.readability}
- ${LAYOUT_KNOWLEDGE.hierarchy}
- ${LAYOUT_KNOWLEDGE[profile.primary] || LAYOUT_KNOWLEDGE.tension}
- Reject novelty that damages reading order, dialogue room, panel readability, or the emotional landing.
- A layout passes only when narrative, pacing, readingFlow, hierarchy, emotion, and production are all usable. Quality is not a self-reported feeling; score each dimension from 0 to 1.

PRE-RANKED CANDIDATES:
${candidates}

PREVIOUS ROUND:
${previous ? JSON.stringify(previous) : 'none'}

Decision procedure:
1. Score the candidates independently on narrative, pacing, readingFlow, hierarchy, emotion, and production.
2. Select one real candidate index from the supplied pool.
3. Compute quality as the weighted decision quality, not as an arbitrary confidence value.
4. Return "pass" only when quality >= ${input.decisionThreshold} and no critical score is below 0.72. Otherwise return "refine".
5. If refining, name concrete mutations such as "increase final panel area", "move reveal later", "reduce tilt", or "reserve dialogue space". Do not invent layout indexes.

JSON shape:
{
  "status": "pass",
  "selectedLayoutIndex": 0,
  "quality": 0.86,
  "confidence": 0.84,
  "reasoning": "...",
  "deficits": [],
  "mutations": [],
  "scores": {"narrative":0.86,"pacing":0.86,"readingFlow":0.86,"hierarchy":0.86,"emotion":0.86,"production":0.86},
  "rankedLayouts": [{"index":0,"fit":0.86,"reason":"..."}]
}`
}

function buildStoryboardPrompt(input, ranking, decisionFlow) {
  const selected = ranking.ranked.find((candidate) => candidate.index === decisionFlow.selectedLayoutIndex) || ranking.ranked[0]
  const template = input.promptTemplate || 'Write a precise production prompt for every panel while preserving the judged layout decision.'
  const profile = ranking.decision
  return `You are the LLM storyboard writer after a separate CF-JEV decision. Do not change the selected layout.

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

SELECTED LAYOUT INDEX: ${decisionFlow.selectedLayoutIndex}
SELECTED LAYOUT FEATURES: ${JSON.stringify(selected || {})}
SCENARIO: ${profile.primary}
CF-JEV DECISION TRACE: ${JSON.stringify(decisionFlow.trace)}

MANGA KNOWLEDGE:
- ${LAYOUT_KNOWLEDGE.readability}
- ${LAYOUT_KNOWLEDGE.hierarchy}
- ${LAYOUT_KNOWLEDGE[profile.primary] || LAYOUT_KNOWLEDGE.tension}

Write exactly ${selected?.panelCount || input.desiredPanels} story boxes. Preserve the supplied facts. Sequence setup → pressure or exchange → turn → consequence when supported.
For every panel, generate a "bubbles" array. Insert bubbles only where the story needs them:
- "speech" for spoken dialogue
- "thought" for internal monologue or psychology
- "caption" for narration or time/place
- "whisper" for restrained/private voice
- "shout" for exaggerated emotional force
- "broadcast" for radio/announcement voice
- "sfx" for a meaningful sound effect
Use zero bubbles for a silent beat. Use at most two bubbles per panel. Keep text short enough to fit the panel. Never invent facts, names, or dialogue not supported by context. Set placement to top-left, top-right, center, bottom-left, or bottom-right; set tail to character or none; emphasis is 0 to 1.
Each production prompt must include subject, action, facial/body performance, framing, environment, lighting, continuity, negative constraints, and bubble placement.

Return only JSON:
{
  "selectedLayoutIndex": ${decisionFlow.selectedLayoutIndex},
  "decisionModel": "CF-JEV:${input.model}",
  "scenario": "${profile.primary}",
  "confidence": ${decisionFlow.confidence},
  "reasoning": "${clean(decisionFlow.reasoning, 'CF-JEV selected the strongest verified candidate.', 500)}",
  "summary": "...",
  "decisionRounds": ${decisionFlow.trace.length},
  "threshold": ${input.decisionThreshold},
  "decisionTrace": ${JSON.stringify(decisionFlow.trace)},
  "rankedLayouts": ${JSON.stringify(decisionFlow.rankedLayouts)},
  "storyBoxes": [{
    "panelNumber": 1,
    "beat": "...",
    "shot": "...",
    "action": "...",
    "dialogue": "...",
    "emotion": "...",
    "background": "...",
    "camera": "...",
    "prompt": "...",
    "bubbles": [{"type":"speech","voice":"dialogue","text":"...","placement":"top-right","emphasis":0.5,"tail":"character"}]
  }]
}`
}

function repairJson(text) {
  const stack = []
  let inString = false
  let escape = false
  for (const character of text) {
    if (inString) {
      if (escape) escape = false
      else if (character === '\\') escape = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{' || character === '[') stack.push(character)
    else if (character === '}' || character === ']') stack.pop()
  }
  let repaired = text
  if (inString) repaired += '"'
  repaired = repaired.replace(/,\s*$/, '')
  while (stack.length) repaired += stack.pop() === '{' ? '}' : ']'
  return repaired
}

function extractJson(value) {
  let payload = value
  for (let depth = 0; depth < 4 && payload != null && typeof payload !== 'string'; depth += 1) {
    if (Array.isArray(payload.choices) && payload.choices[0]?.message) {
      payload = payload.choices[0].message.content ?? payload.choices[0].message
      continue
    }
    const next = payload.response ?? payload.result ?? payload.data
    if (!next || next === payload) break
    payload = next
  }
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try {
    return JSON.parse(candidate)
  } catch (error) {
    try {
      return JSON.parse(repairJson(candidate))
    } catch {
      throw error
    }
  }
}

function clampScore(value, fallback = 0) {
  return Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback))
}

function fallbackDecision(input, ranking) {
  const selected = ranking.ranked[0] || { index: 0, heuristicScore: 0.5, heuristicReason: 'fallback candidate' }
  return {
    status: selected.heuristicScore >= input.decisionThreshold ? 'pass' : 'refine',
    selectedLayoutIndex: selected.index,
    quality: selected.heuristicScore,
    confidence: selected.heuristicScore,
    reasoning: `The ${ranking.decision.primary} rubric ranked this candidate highest for panel count, hierarchy, reading flow, and scenario fit.`,
    deficits: selected.heuristicScore >= input.decisionThreshold ? [] : ['The deterministic score is below the requested threshold.'],
    mutations: selected.heuristicScore >= input.decisionThreshold ? [] : ['Generate a targeted variation around the highest-scoring candidate.'],
    scores: { narrative: selected.heuristicScore, pacing: selected.heuristicScore, readingFlow: selected.heuristicScore, hierarchy: selected.heuristicScore, emotion: selected.heuristicScore, production: selected.heuristicScore },
    rankedLayouts: ranking.ranked.slice(0, 8).map((candidate) => ({ index: candidate.index, fit: candidate.heuristicScore, reason: candidate.heuristicReason })),
  }
}

function normalizeDecision(raw, input, ranking) {
  const fallback = fallbackDecision(input, ranking)
  const result = raw && typeof raw === 'object' ? raw : {}
  const validIndexes = new Set(ranking.ranked.map((candidate) => candidate.index))
  const selectedLayoutIndex = validIndexes.has(result.selectedLayoutIndex) ? result.selectedLayoutIndex : fallback.selectedLayoutIndex
  const scores = Object.fromEntries(Object.entries(fallback.scores).map(([key, value]) => [key, clampScore(result.scores?.[key], value)]))
  const quality = clampScore(result.quality, Object.values(scores).reduce((sum, value) => sum + value, 0) / Object.keys(scores).length)
  const rankedLayouts = (Array.isArray(result.rankedLayouts) ? result.rankedLayouts : fallback.rankedLayouts).map((item) => ({
    index: Number.isInteger(item.index) ? item.index : 0,
    fit: clampScore(item.fit),
    reason: clean(item.reason, 'scenario and readability fit', 300),
  })).filter((item) => validIndexes.has(item.index)).slice(0, 8)
  return {
    status: quality >= input.decisionThreshold && Math.min(...Object.values(scores)) >= 0.72 ? 'pass' : 'refine',
    selectedLayoutIndex,
    quality,
    confidence: clampScore(result.confidence, quality),
    reasoning: clean(result.reasoning, fallback.reasoning, 1200),
    deficits: Array.isArray(result.deficits) ? result.deficits.map((item) => clean(item, '', 240)).filter(Boolean).slice(0, 5) : fallback.deficits,
    mutations: Array.isArray(result.mutations) ? result.mutations.map((item) => clean(item, '', 300)).filter(Boolean).slice(0, 5) : fallback.mutations,
    scores,
    rankedLayouts: rankedLayouts.length ? rankedLayouts : fallback.rankedLayouts,
  }
}

async function callJsonModel(env, input, prompt, schema, maxTokens = input.maxTokens) {
  const response = await env.AI.run(input.model, {
    messages: [
      { role: 'system', content: 'You are a precise manga production system. Follow the requested JSON schema exactly. Do not use markdown.' },
      { role: 'user', content: prompt },
    ],
    temperature: input.temperature,
    max_completion_tokens: maxTokens,
    reasoning_effort: 'low',
    response_format: { type: 'json_schema', json_schema: schema },
  })
  return extractJson(response?.response ?? response)
}

async function runDecisionRounds(input, ranking, env) {
  const trace = []
  let previous = null
  let final = fallbackDecision(input, ranking)
  for (let round = 1; round <= input.decisionRounds; round += 1) {
    try {
      const raw = await callJsonModel(env, input, buildDecisionPrompt(input, ranking, round, previous), DECISION_ROUND_SCHEMA, input.maxTokens)
      final = normalizeDecision(raw, input, ranking)
      trace.push({ round, ...final })
      previous = trace[trace.length - 1]
      if (final.status === 'pass') break
    } catch (error) {
      const degraded = { ...fallbackDecision(input, ranking), reasoning: clean(error?.message, 'Decision round failed', 400) }
      final = trace.length ? { ...trace[trace.length - 1] } : degraded
      trace.push({ round, ...degraded })
      break
    }
  }
  return { ...final, trace }
}

function fallbackStoryboard(input, ranking = rankCandidates(input), decisionFlow = fallbackDecision(input, ranking)) {
  const selected = ranking.ranked.find((candidate) => candidate.index === decisionFlow.selectedLayoutIndex) || ranking.ranked[0] || { index: 0, panelCount: input.desiredPanels, seed: 'fallback', heuristicScore: 0.5 }
  const count = selected.panelCount || input.desiredPanels
  const beats = ['Establish the situation', 'Introduce pressure', 'Force a choice', 'Escalate the cost', 'Reveal the turn', 'Land the consequence']
  return {
    selectedLayoutIndex: selected.index,
    selectedSeed: selected.seed,
    decisionModel: 'CF-JEV:deterministic-fallback',
    scenario: ranking.decision.primary,
    confidence: decisionFlow.confidence,
    reasoning: decisionFlow.reasoning,
    summary: `${input.title}: ${input.plot}`,
    decisionRounds: decisionFlow.trace?.length || 0,
    threshold: input.decisionThreshold,
    decisionTrace: decisionFlow.trace || [],
    rankedLayouts: decisionFlow.rankedLayouts,
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
      bubbles: input.dialogueDensity === 'none' || index % 3 === 2 ? [] : [{
        type: index % 3 === 1 ? 'thought' : 'speech',
        voice: index % 3 === 1 ? 'monologue' : 'dialogue',
        text: index % 3 === 1 ? 'Can I really protect them?' : 'A short line that clarifies intent.',
        placement: index % 2 ? 'top-left' : 'top-right',
        emphasis: index % 3 === 1 ? 0.5 : 0.4,
        tail: index % 3 === 1 ? 'none' : 'character',
      }],
    })),
  }
}

function normalizeResult(raw, input, ranking, decisionFlow) {
  const fallback = fallbackStoryboard(input, ranking, decisionFlow)
  const result = raw && typeof raw === 'object' ? raw : {}
  const candidateIndexes = new Set(input.candidates.map((candidate) => candidate.index))
  const selectedLayoutIndex = candidateIndexes.has(result.selectedLayoutIndex) ? result.selectedLayoutIndex : decisionFlow.selectedLayoutIndex
  const boxes = Array.isArray(result.storyBoxes) ? result.storyBoxes : []
  const rawRanked = Array.isArray(result.rankedLayouts) ? result.rankedLayouts : []
  const rankedLayouts = (rawRanked.length ? rawRanked : decisionFlow.rankedLayouts).slice(0, 8).map((item) => ({
    index: Number.isInteger(item.index) ? item.index : 0,
    fit: clampScore(item.fit),
    reason: clean(item.reason, 'scenario and readability fit', 300),
  })).filter((item) => candidateIndexes.has(item.index))
  return {
    selectedLayoutIndex,
    selectedSeed: input.candidates.find((candidate) => candidate.index === selectedLayoutIndex)?.seed || fallback.selectedSeed,
    decisionModel: clean(result.decisionModel, `CF-JEV:${input.model}`, 160),
    scenario: clean(result.scenario, ranking.decision.primary, 80),
    confidence: clampScore(result.confidence, decisionFlow.confidence),
    reasoning: clean(result.reasoning, decisionFlow.reasoning, 1200),
    summary: clean(result.summary, fallback.summary, 1600),
    decisionRounds: Number(result.decisionRounds) || decisionFlow.trace.length,
    threshold: clampScore(result.threshold, input.decisionThreshold),
    decisionTrace: decisionFlow.trace?.length ? decisionFlow.trace : (Array.isArray(result.decisionTrace) ? result.decisionTrace.slice(0, input.decisionRounds) : []),
    rankedLayouts: rankedLayouts.length ? rankedLayouts : decisionFlow.rankedLayouts,
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
      bubbles: (Array.isArray(box.bubbles) ? box.bubbles : []).slice(0, 2).map((bubble) => ({
        type: ['speech', 'thought', 'caption', 'whisper', 'shout', 'broadcast', 'sfx'].includes(bubble.type) ? bubble.type : 'speech',
        voice: ['dialogue', 'monologue', 'narration', 'sound'].includes(bubble.voice) ? bubble.voice : 'dialogue',
        text: clean(bubble.text, box.dialogue, 240),
        placement: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'].includes(bubble.placement) ? bubble.placement : 'top-right',
        emphasis: clampScore(bubble.emphasis, 0.5),
        tail: bubble.tail === 'none' ? 'none' : 'character',
      })).filter((bubble) => bubble.text),
    })),
  }
}

async function generateStoryboard(input, env) {
  const normalized = normalizeInput(input)
  const ranking = rankCandidates(normalized)
  const fallbackDecisionResult = fallbackDecision(normalized, ranking)
  let decisionFlow = null
  if (!env.AI) return fallbackStoryboard(normalized, ranking, { ...fallbackDecisionResult, trace: [] })
  try {
    decisionFlow = await runDecisionRounds(normalized, ranking, env)
    let raw
    try {
      raw = await callJsonModel(env, normalized, buildStoryboardPrompt(normalized, ranking, decisionFlow), STORYBOARD_RESPONSE_SCHEMA, normalized.maxTokens)
    } catch (writerError) {
      raw = await callJsonModel(env, normalized, buildStoryboardPrompt(normalized, ranking, decisionFlow), STORYBOARD_RESPONSE_SCHEMA, normalized.maxTokens)
    }
    return normalizeResult(raw, normalized, ranking, decisionFlow)
  } catch (error) {
    return { ...fallbackStoryboard(normalized, ranking, decisionFlow || fallbackDecisionResult), aiError: clean(error?.message, 'Workers AI unavailable', 280) }
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
    description: 'Use the manga-author rubric and Cloudflare decision model to choose the strongest layout from a scenario-aware shortlist, then return production-ready prompts for every story box.',
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
      decisionRounds: z.number().optional(),
      decisionThreshold: z.number().optional(),
      candidates: z.array(z.object({
        index: z.number(),
        panelCount: z.number(),
        seed: z.string().optional(),
        ratio: z.number().optional(),
        mode: z.string().optional(),
        rowCount: z.number().optional(),
        largestPanelShare: z.number().optional(),
        smallestPanelShare: z.number().optional(),
        firstPanelShare: z.number().optional(),
        lastPanelShare: z.number().optional(),
        hierarchy: z.number().optional(),
        tilt: z.number().optional(),
        nestedPanels: z.number().optional(),
        bleedEdges: z.number().optional(),
      })).optional(),
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
    description: 'Apply the deterministic manga-author rubric to rank layouts by scenario, pacing, hierarchy, readability, and panel count.',
    inputSchema: {
      desiredPanels: z.number(),
      world: z.string().optional(),
      chapter: z.string().optional(),
      plot: z.string().optional(),
      events: z.string().optional(),
      setting: z.string().optional(),
      style: z.string().optional(),
      dialogueDensity: z.enum(['none', 'light', 'balanced', 'dense']).optional(),
      decisionRounds: z.number().optional(),
      decisionThreshold: z.number().optional(),
      candidates: z.array(z.object({
        index: z.number(),
        panelCount: z.number(),
        seed: z.string().optional(),
        ratio: z.number().optional(),
        mode: z.string().optional(),
        rowCount: z.number().optional(),
        largestPanelShare: z.number().optional(),
        smallestPanelShare: z.number().optional(),
        firstPanelShare: z.number().optional(),
        lastPanelShare: z.number().optional(),
        hierarchy: z.number().optional(),
        tilt: z.number().optional(),
        nestedPanels: z.number().optional(),
        bleedEdges: z.number().optional(),
      })),
    },
  }, async (args) => {
    const ranking = rankCandidates(normalizeInput(args))
    const choice = ranking.ranked[0]
    return { content: [{ type: 'text', text: JSON.stringify({
      selectedLayoutIndex: choice?.index ?? 0,
      selectedSeed: choice?.seed ?? '',
      scenario: ranking.decision.primary,
      confidence: choice?.heuristicScore ?? 0,
      rankedLayouts: ranking.ranked.slice(0, 8).map((candidate) => ({ index: candidate.index, fit: candidate.heuristicScore, reason: candidate.heuristicReason })),
      reason: choice?.heuristicReason || 'No candidate supplied.',
    }) }] }
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
    { name: 'generate_storyboard', description: 'Use a manga-author rubric plus the Cloudflare decision model to judge a scenario-aware layout shortlist.' },
    { name: 'get_emotional_tips', description: 'Return varied emotional layout guidance.' },
    { name: 'select_best_layout', description: 'Rank layout candidates deterministically by scenario, pacing, hierarchy, readability, and panel count.' },
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
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
    const auth = await handleAuth(request, env, url.pathname)
    if (auth) return auth
    if (!(await isAuthorized(request, env))) return unauthorizedResponse(request, url.pathname)
    const rest = await handleRest(request, env, url.pathname)
    if (rest) return rest
    if (url.pathname === '/mcp') {
      if (request.method === 'GET') return jsonResponse({ ...mcpMetadata, message: 'Send MCP JSON-RPC requests with POST.' })
      return createMcpHandler(() => createServer(env), { route: '/mcp', responseMode: 'json' })(request, env, ctx)
    }
    return env.ASSETS.fetch(request)
  },
}
