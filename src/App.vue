<script setup>
import { zipSync, strToU8 } from 'fflate'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

const PRESETS = {
  seizen: { tilt: 0, bleed: 5, nest: 15, big: 8, rows: '3-4' },
  std: { tilt: 25, bleed: 20, nest: 20, big: 20, rows: '2-4' },
  action: { tilt: 55, bleed: 45, nest: 28, big: 35, rows: '2-3' },
  tobira: { tilt: 40, bleed: 75, nest: 10, big: 70, rows: '1-3' },
}

const settings = reactive({
  preset: 'std',
  ratio: '0.708',
  rows: '2-4',
  tilt: 25,
  bleed: 20,
  nest: 20,
  big: 20,
  lineW: 4,
  count: 24,
  seed: 'SC-2026',
  numbers: true,
  guide: true,
  mutation: 35,
  dialogueBoxes: false,
  dialogueStyle: 'mixed',
  dialogueDensity: 32,
})

const LANGUAGES = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
]

const COPY = {
  ja: {
    title: 'コマ割りジェネレーター',
    desc: 'マンガのコマ割りパターンを束で生成し、SVG/PNG/ORAで書き出してクリスタやGIMPへ。読み順＝右→左・上→下。',
    layout: 'コマ割り',
    storyboard: 'AIネーム',
    tips: '感情の設計',
    openTips: '感情タブを開く',
    settings: '生成設定',
    panelLayout: '判型',
    rows: '段数',
    line: '枠線太さ',
    count: '枚数',
    seed: 'seed',
    roll: '新しい束を生成',
    numbers: '読み順番号',
    guide: '内枠ガイド',
    dialogue: '台詞枠',
    dialogueStyle: '枠の種類',
    dialogueDensity: '枠の密度',
    mutation: '変異度',
    preview: 'コマ割りプレビュー',
    mutate: 'これをベースに変異',
    svg: 'SVG保存',
    png: 'PNG保存 (縦2400px)',
    ora: 'ORA保存 (GIMPレイヤー)',
    storyboardTitle: 'LLMでネームを即生成',
    storyboardDesc: '世界・章・プロット・キーイベントを渡すと、マンガ編集者の基準で割りを先に順位付けし、Cloudflareの決定モデルが最終候補を選びます。',
    world: '世界設定',
    chapter: '章',
    plot: 'キー・プロット',
    events: 'キーイベント',
    setting: '背景・舞台',
    characters: '登場人物',
    style: '画面のスタイル',
    desiredPanels: '希望コマ数',
    promptTemplate: 'プロンプト指示',
    promptHelp: 'モデルへの指示を調整できます。テンポ・大小の差・読みやすさ・シナリオ適合度で候補を先に評価してからLLMが決定します。',
    generate: 'ネームを生成',
    generating: '生成中…',
    decision: 'Cloudflare decision model',
    summary: 'シーケンス要約',
    reasoning: '割りを選んだ理由',
    scenario: 'シナリオ基準',
    confidence: '確信度',
    ranked: '候補順位',
    storyBox: 'ストーリーボックス',
    prompt: '制作プロンプト',
    beat: 'ビート',
    background: '背景',
    emotion: '感情',
    camera: 'カメラ',
    emotionTips: '感情の設計ヒント',
    emotionScene: 'シーン',
    getTips: 'ヒントを取得',
    newTab: '新しいタブで開く',
    noAi: 'AI binding がない場合はローカルのフォールバックを使います。',
    gimpNote: 'ORAはGIMP互換のレイヤー付きOpenRasterです。GIMPで開いてXCFとして保存できます。',
  },
  en: {
    title: 'Manga Layout Generator',
    desc: 'Generate manga panel bundles and export SVG, PNG, or layered OpenRaster for Clip Studio and GIMP. Reading order: right to left, top to bottom.',
    layout: 'Layouts',
    storyboard: 'AI storyboard',
    tips: 'Emotional direction',
    openTips: 'Open tips tab',
    settings: 'Generation settings',
    panelLayout: 'Page',
    rows: 'Rows',
    line: 'Frame width',
    count: 'Bundle',
    seed: 'seed',
    roll: 'Generate new bundle',
    numbers: 'Reading numbers',
    guide: 'Inner-frame guide',
    dialogue: 'Dialogue boxes',
    dialogueStyle: 'Box style',
    dialogueDensity: 'Box density',
    mutation: 'Mutation',
    preview: 'Panel preview',
    mutate: 'Mutate from this layout',
    svg: 'Save SVG',
    png: 'Save PNG (2400px tall)',
    ora: 'Save ORA (GIMP layers)',
    storyboardTitle: 'Generate a storyboard with an LLM',
    storyboardDesc: 'Describe the world, chapter, plot, and key events. A manga-editor rubric pre-ranks layouts, then the Cloudflare decision model judges the shortlist.',
    world: 'World / chapter setting',
    chapter: 'Chapter',
    plot: 'Key plot',
    events: 'Key events',
    setting: 'Background setting',
    characters: 'Characters',
    style: 'Visual style',
    desiredPanels: 'Target panels',
    promptTemplate: 'Prompt instructions',
    promptHelp: 'Tune the instructions sent to the model. Layouts are pre-ranked for pacing, hierarchy, readability, and scenario fit before the LLM makes the final choice.',
    generate: 'Generate storyboard',
    generating: 'Generating…',
    decision: 'Cloudflare decision model',
    summary: 'Sequence summary',
    reasoning: 'Layout reasoning',
    scenario: 'Scenario rubric',
    confidence: 'Confidence',
    ranked: 'Ranked candidates',
    storyBox: 'Story box',
    prompt: 'Production prompt',
    beat: 'Beat',
    background: 'Background',
    emotion: 'Emotion',
    camera: 'Camera',
    emotionTips: 'Emotional direction tips',
    emotionScene: 'Scene',
    getTips: 'Get tips',
    newTab: 'Open in new tab',
    noAi: 'If the AI binding is unavailable, the app uses a deterministic local fallback.',
    gimpNote: 'ORA is a layered OpenRaster file supported by GIMP. Open it in GIMP and Save As XCF when you need a native XCF.',
  },
  zh: {
    title: '漫画分镜生成器',
    desc: '生成漫画格子布局，并导出 SVG、PNG 或带图层的 OpenRaster，用于 Clip Studio 和 GIMP。阅读顺序：从右到左、从上到下。',
    layout: '分镜布局',
    storyboard: 'AI分镜',
    tips: '情绪设计',
    openTips: '在新标签页打开',
    settings: '生成设置',
    panelLayout: '画幅',
    rows: '行数',
    line: '边框粗细',
    count: '数量',
    seed: 'seed',
    roll: '生成新的一组',
    numbers: '阅读顺序编号',
    guide: '内框辅助线',
    dialogue: '对白框',
    dialogueStyle: '框样式',
    dialogueDensity: '框密度',
    mutation: '变异度',
    preview: '布局预览',
    mutate: '以此布局生成变体',
    svg: '保存 SVG',
    png: '保存 PNG（高度2400px）',
    ora: '保存 ORA（GIMP图层）',
    storyboardTitle: '用 LLM 立即生成分镜',
    storyboardDesc: '填写世界、章节、剧情和关键事件，先用漫画编辑标准对布局候选排序，再由 Cloudflare 决策模型判断最合适的方案。',
    world: '世界 / 章节设定',
    chapter: '章节',
    plot: '关键剧情',
    events: '关键事件',
    setting: '背景设定',
    characters: '角色',
    style: '画面风格',
    desiredPanels: '目标格数',
    promptTemplate: '提示词指令',
    promptHelp: '可以自由调整发送给模型的指令。候选会先按节奏、大小层级、可读性和场景适配度评分，再由 LLM 做最终选择。',
    generate: '生成分镜',
    generating: '生成中…',
    decision: 'Cloudflare 决策模型',
    summary: '故事概览',
    reasoning: '布局选择理由',
    scenario: '场景基准',
    confidence: '置信度',
    ranked: '候选排名',
    storyBox: '故事格',
    prompt: '制作提示词',
    beat: '节拍',
    background: '背景',
    emotion: '情绪',
    camera: '镜头',
    emotionTips: '情绪设计提示',
    emotionScene: '场景',
    getTips: '获取提示',
    newTab: '在新标签页打开',
    noAi: '如果没有 AI binding，将使用确定性的本地备用方案。',
    gimpNote: 'ORA 是 GIMP 支持的分层 OpenRaster 文件。用 GIMP 打开后可另存为原生 XCF。',
  },
}

const language = ref('ja')
const workspace = ref(new URLSearchParams(window.location.search).get('view') || 'layout')
const storyboard = reactive({
  title: '',
  world: '',
  chapter: '',
  plot: '',
  events: '',
  setting: '',
  characters: '',
  style: '',
  desiredPanels: 6,
  dialogueDensity: 'balanced',
  temperature: 0.55,
  maxTokens: 1800,
  model: '@cf/meta/llama-3.1-8b-instruct-fast',
  promptTemplate: 'Choose the strongest layout for the emotional rhythm, then write a precise production prompt for every panel. Preserve visual continuity and never invent facts outside the context.',
})
const storyboardResult = ref(null)
const storyboardLoading = ref(false)
const storyboardError = ref('')
const tipEmotion = ref('tension')
const tipScene = ref('')
const tipResult = ref(null)
const tipLoading = ref(false)

const mode = ref('gacha')
const layouts = ref([])
const currentIndex = ref(0)
const baseGenome = ref(null)
const baseLabel = ref('')
const viewer = ref(null)

const clone = (value) => JSON.parse(JSON.stringify(value))
const lerp = (a, b, t) => a + (b - a) * t

function strHash(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(value) {
  return function random() {
    value |= 0
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function irnd(random, min, max) {
  return min + Math.floor(random() * (max - min + 1))
}

function wpick(random, weights) {
  const total = weights.reduce((sum, item) => sum + item, 0)
  let value = random() * total
  for (let i = 0; i < weights.length; i += 1) {
    value -= weights[i]
    if (value < 0) return i
  }
  return weights.length - 1
}

function hLine(yLeft, yRight, width) {
  return { y0: yLeft, m: (yRight - yLeft) / width }
}

function vLine(xa, ya, xb, yb) {
  const k = (xb - xa) / ((yb - ya) || 1e-6)
  return { x0: xa - k * ya, k }
}

function vVert(x) {
  return { x0: x, k: 0 }
}

function isect(horizontal, vertical) {
  const x = (vertical.x0 + vertical.k * horizontal.y0) / (1 - vertical.k * horizontal.m)
  return [x, horizontal.y0 + horizontal.m * x]
}

function offH(line, distance) {
  return { y0: line.y0 + distance, m: line.m }
}

function offV(line, distance) {
  return { x0: line.x0 + distance, k: line.k }
}

function quad(top, bottom, right, left) {
  return [isect(top, left), isect(top, right), isect(bottom, right), isect(bottom, left)]
}

function randomGenome(random, config) {
  const rowCount = irnd(random, config.rowMin, config.rowMax)
  const rowW = Array.from({ length: rowCount }, () => 0.65 + random())
  let bigRow = -1
  if (rowCount > 1 && random() < config.big) {
    bigRow = irnd(random, 0, rowCount - 1)
    rowW[bigRow] *= 1.8 + config.big * 1.5
  }
  const rowTilt = Array.from({ length: Math.max(0, rowCount - 1) }, () => (random() * 2 - 1) * config.tilt)
  const sum = rowW.reduce((total, weight) => total + weight, 0)
  const rows = []

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const share = rowW[rowIndex] / sum
    const w1 = 0.55 + config.big * 2.2 + (rowIndex === bigRow ? 2.6 : 0) + (share > 0.45 ? 1.3 : 0)
    const columnCount = wpick(random, [w1, 1.5, 1.05]) + 1
    const colW = Array.from({ length: columnCount }, () => 0.7 + random())
    const colTilt = Array.from({ length: Math.max(0, columnCount - 1) }, () => (random() * 2 - 1) * config.tilt)
    const panels = Array.from({ length: columnCount }, () => ({
      nest: random() < config.nest * (columnCount === 1 ? 0.45 : 1) ? { u: 0.38 + random() * 0.24 } : null,
      bT: random() < config.bleed,
      bB: random() < config.bleed,
      bR: random() < config.bleed * 0.9,
      bL: random() < config.bleed * 0.9,
    }))
    rows.push({ colW, colTilt, panels })
  }
  return { rowW, rowTilt, rows }
}

function realize(genome, config) {
  const height = 1000
  const width = Math.round(height * config.ratio)
  const marginY = 56
  const marginX = 50
  const outside = 14
  const rowGap = 16
  const colGap = 9
  const inner = { x0: marginX, y0: marginY, x1: width - marginX, y1: height - marginY }
  const innerHeight = inner.y1 - inner.y0
  const innerWidth = inner.x1 - inner.x0
  const rowCount = genome.rows.length
  const sum = genome.rowW.reduce((total, weight) => total + weight, 0)
  const rowHeights = genome.rowW.map((weight) => (weight / sum) * innerHeight)
  const rowBounds = [inner.y0]
  rowHeights.forEach((rowHeight) => rowBounds.push(rowBounds[rowBounds.length - 1] + rowHeight))
  const rowLines = [hLine(inner.y0, inner.y0, width)]

  for (let i = 1; i < rowCount; i += 1) {
    const distance = (genome.rowTilt[i - 1] || 0) * 0.42 * Math.min(rowHeights[i - 1], rowHeights[i])
    rowLines.push(hLine(rowBounds[i] - distance, rowBounds[i] + distance, width))
  }
  rowLines.push(hLine(inner.y1, inner.y1, width))

  const panels = []
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = genome.rows[rowIndex]
    const topLine = rowLines[rowIndex]
    const bottomLine = rowLines[rowIndex + 1]
    const columnCount = row.colW.length
    const columnSum = row.colW.reduce((total, weight) => total + weight, 0)
    const widths = row.colW.map((weight) => (weight / columnSum) * innerWidth)
    const xBounds = [inner.x1]
    widths.forEach((columnWidth) => xBounds.push(xBounds[xBounds.length - 1] - columnWidth))
    const topY = topLine.y0 + topLine.m * width / 2
    const bottomY = bottomLine.y0 + bottomLine.m * width / 2
    const verticalLines = [vVert(inner.x1)]

    for (let columnIndex = 1; columnIndex < columnCount; columnIndex += 1) {
      const distance = (row.colTilt[columnIndex - 1] || 0) * 0.3 * Math.min(widths[columnIndex - 1], widths[columnIndex])
      verticalLines.push(vLine(xBounds[columnIndex] - distance, topY, xBounds[columnIndex] + distance, bottomY))
    }
    verticalLines.push(vVert(inner.x0))

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const panel = row.panels[columnIndex]
      const isTop = rowIndex === 0
      const isBottom = rowIndex === rowCount - 1
      const isRight = columnIndex === 0
      const isLeft = columnIndex === columnCount - 1
      const top = isTop && panel.bT ? hLine(-outside, -outside, width) : offH(topLine, rowIndex > 0 ? rowGap / 2 : 0)
      const bottom = isBottom && panel.bB ? hLine(height + outside, height + outside, width) : offH(bottomLine, rowIndex < rowCount - 1 ? -rowGap / 2 : 0)
      const right = isRight && panel.bR ? vVert(width + outside) : offV(verticalLines[columnIndex], columnIndex > 0 ? -colGap / 2 : 0)
      const left = isLeft && panel.bL ? vVert(-outside) : offV(verticalLines[columnIndex + 1], columnIndex < columnCount - 1 ? colGap / 2 : 0)

      if (panel.nest && rowHeights[rowIndex] > 160) {
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

function generate(seed, config) {
  const random = mulberry32(strHash(seed))
  const genome = randomGenome(random, config)
  return { seed, genome, ...realize(genome, config) }
}

function jit(random, value, amount, min, max) {
  return Math.min(max, Math.max(min, value + (random() * 2 - 1) * amount))
}

function mutate(genome, random, strength) {
  const next = clone(genome)
  next.rowW = next.rowW.map((weight) => jit(random, weight, 0.55 * strength, 0.3, 3.2))
  next.rowTilt = next.rowTilt.map((tilt) => jit(random, tilt, 0.55 * strength, -1, 1))
  next.rows.forEach((row) => {
    row.colW = row.colW.map((weight) => jit(random, weight, 0.5 * strength, 0.35, 3))
    row.colTilt = row.colTilt.map((tilt) => jit(random, tilt, 0.5 * strength, -1, 1))
    row.panels.forEach((panel) => {
      if (panel.nest) panel.nest.u = jit(random, panel.nest.u, 0.14 * strength, 0.3, 0.7)
    })
  })

  const pickRow = () => irnd(random, 0, next.rows.length - 1)
  if (random() < strength * 0.55) {
    const row = next.rows[pickRow()]
    const panel = row.panels[irnd(random, 0, row.panels.length - 1)]
    panel.nest = panel.nest ? null : { u: 0.38 + random() * 0.24 }
  }

  if (random() < strength * 0.5) {
    const row = next.rows[pickRow()]
    const columnCount = row.colW.length
    const canAdd = columnCount < 3
    const canRemove = columnCount > 1
    if (canRemove && (!canAdd || random() < 0.5)) {
      const columnIndex = irnd(random, 0, columnCount - 1)
      row.colW.splice(columnIndex, 1)
      row.panels.splice(columnIndex, 1)
      row.colTilt.splice(Math.min(columnIndex, row.colTilt.length - 1), 1)
    } else if (canAdd) {
      const columnIndex = irnd(random, 0, columnCount)
      row.colW.splice(columnIndex, 0, 0.7 + random())
      row.panels.splice(columnIndex, 0, { nest: null, bT: random() < 0.2, bB: random() < 0.2, bR: random() < 0.2, bL: random() < 0.2 })
      row.colTilt.splice(Math.min(columnIndex, row.colTilt.length), 0, (random() * 2 - 1) * 0.4)
    }
  }

  if (random() < strength * 0.6) {
    const rowIndex = pickRow()
    const row = next.rows[rowIndex]
    const columnIndex = irnd(random, 0, row.panels.length - 1)
    const panel = row.panels[columnIndex]
    const sides = []
    if (rowIndex === 0) sides.push('bT')
    if (rowIndex === next.rows.length - 1) sides.push('bB')
    if (columnIndex === 0) sides.push('bR')
    if (columnIndex === row.panels.length - 1) sides.push('bL')
    if (sides.length) {
      const side = sides[irnd(random, 0, sides.length - 1)]
      panel[side] = !panel[side]
    }
  }

  if (random() < strength * strength * 0.45) {
    if (next.rows.length > 1 && random() < 0.5) {
      const rowIndex = irnd(random, 0, next.rows.length - 1)
      next.rows.splice(rowIndex, 1)
      next.rowW.splice(rowIndex, 1)
      if (next.rowTilt.length) next.rowTilt.splice(Math.min(rowIndex, next.rowTilt.length - 1), 1)
    } else if (next.rows.length < 4) {
      const source = clone(next.rows[irnd(random, 0, next.rows.length - 1)])
      const rowIndex = irnd(random, 0, next.rows.length)
      next.rows.splice(rowIndex, 0, source)
      next.rowW.splice(rowIndex, 0, 0.65 + random())
      next.rowTilt.splice(Math.min(rowIndex, next.rowTilt.length), 0, (random() * 2 - 1) * 0.4)
    }
  }
  return next
}

function readConfig() {
  const [rowMin, rowMax] = settings.rows.split('-').map(Number)
  return {
    ratio: Number(settings.ratio),
    rowMin,
    rowMax,
    tilt: settings.tilt / 100,
    bleed: settings.bleed / 100,
    nest: settings.nest / 100 * 0.6,
    big: settings.big / 100 * 0.8,
    lineW: settings.lineW,
    count: settings.count,
  }
}

function dialogueMarkup(layout, options = {}) {
  if (!options.dialogue) return ''
  const density = Math.min(100, Math.max(0, options.dialogueDensity ?? settings.dialogueDensity))
  if (!density) return ''
  const random = mulberry32(strHash(`${layout.seed}:dialogue`))
  let markup = ''
  layout.panels.forEach((panel) => {
    if (random() * 100 > density) return
    const xs = panel.pts.map((point) => point[0])
    const ys = panel.pts.map((point) => point[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const width = Math.max(68, Math.min(150, (maxX - minX) * 0.58))
    const height = Math.max(40, Math.min(76, (maxY - minY) * 0.18))
    const cx = (minX + maxX) / 2
    const cy = minY + (maxY - minY) * (0.2 + random() * 0.28)
    const style = options.dialogueStyle === 'mixed'
      ? ['speech', 'whisper', 'shout', 'thought', 'caption'][Math.floor(random() * 5)]
      : options.dialogueStyle
    const stroke = '#1E78C8'
    if (style === 'caption') {
      markup += `<rect x="${(cx - width / 2).toFixed(1)}" y="${(cy - height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="6" fill="#FFF" fill-opacity=".88" stroke="${stroke}" stroke-width="3"/>`
    } else if (style === 'thought') {
      markup += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(width / 2).toFixed(1)}" ry="${(height / 2).toFixed(1)}" fill="#FFF" fill-opacity=".9" stroke="${stroke}" stroke-width="3"/><circle cx="${(cx - width * .3).toFixed(1)}" cy="${(cy + height * .7).toFixed(1)}" r="7" fill="#FFF" stroke="${stroke}" stroke-width="2"/><circle cx="${(cx - width * .42).toFixed(1)}" cy="${(cy + height * .9).toFixed(1)}" r="4" fill="#FFF" stroke="${stroke}" stroke-width="2"/>`
    } else if (style === 'shout') {
      const points = Array.from({ length: 16 }, (_, pointIndex) => {
        const angle = (Math.PI * 2 * pointIndex) / 16
        const radiusX = pointIndex % 2 ? width * .42 : width * .5
        const radiusY = pointIndex % 2 ? height * .42 : height * .5
        return `${(cx + Math.cos(angle) * radiusX).toFixed(1)},${(cy + Math.sin(angle) * radiusY).toFixed(1)}`
      }).join(' ')
      markup += `<polygon points="${points}" fill="#FFF" fill-opacity=".9" stroke="${stroke}" stroke-width="3"/>`
    } else {
      const dash = style === 'whisper' ? ' stroke-dasharray="7 5"' : ''
      markup += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(width / 2).toFixed(1)}" ry="${(height / 2).toFixed(1)}" fill="#FFF" fill-opacity=".9" stroke="${stroke}" stroke-width="3"${dash}/><polygon points="${(cx - width * .2).toFixed(1)},${(cy + height * .42).toFixed(1)} ${(cx - width * .04).toFixed(1)},${(cy + height * .36).toFixed(1)} ${(cx - width * .28).toFixed(1)},${(cy + height * .7).toFixed(1)}" fill="#FFF" stroke="${stroke}" stroke-width="3"/>`
    }
  })
  return markup
}

function panelLayerSvg(layout, panelIndex, lineWidth) {
  const panel = layout.panels[panelIndex]
  const points = panel.pts.map((point) => `${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}"><polygon points="${points}" fill="none" stroke="#101417" stroke-width="${lineWidth}" stroke-linejoin="miter"/></svg>`
}

function svgMarkup(layout, options = {}) {
  const dialogue = options.dialogue ?? settings.dialogueBoxes
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}">`
  svg += `<rect x="0" y="0" width="${layout.width}" height="${layout.height}" fill="#ffffff"/>`
  layout.panels.forEach((panel) => {
    const points = panel.pts.map((point) => `${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ')
    svg += `<polygon points="${points}" fill="#ffffff" stroke="#101417" stroke-width="${options.lineW ?? settings.lineW}" stroke-linejoin="miter"/>`
  })
  svg += dialogueMarkup(layout, { dialogue, dialogueStyle: options.dialogueStyle ?? settings.dialogueStyle, dialogueDensity: options.dialogueDensity ?? settings.dialogueDensity })
  if (options.guide) {
    svg += `<rect x="${layout.inner.x0}" y="${layout.inner.y0}" width="${layout.inner.x1 - layout.inner.x0}" height="${layout.inner.y1 - layout.inner.y0}" fill="none" stroke="#38a5e0" stroke-width="2" stroke-dasharray="8 6" opacity="0.7"/>`
  }
  if (options.numbers) {
    layout.panels.forEach((panel, index) => {
      const centerX = panel.pts.reduce((sum, point) => sum + point[0], 0) / 4
      const centerY = panel.pts.reduce((sum, point) => sum + point[1], 0) / 4
      svg += `<g><circle cx="${centerX.toFixed(1)}" cy="${centerY.toFixed(1)}" r="22" fill="#1E78C8" opacity="0.9"/><text x="${centerX.toFixed(1)}" y="${(centerY + 8).toFixed(1)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#ffffff">${index + 1}</text></g>`
    })
  }
  return `${svg}</svg>`
}

function renderSvgToPng(svg, width, height) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(image, 0, 0, width, height)
      canvas.toBlob(async (blob) => {
        URL.revokeObjectURL(url)
        if (!blob) return reject(new Error('Could not encode PNG'))
        resolve(new Uint8Array(await blob.arrayBuffer()))
      }, 'image/png')
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not render SVG'))
    }
    image.src = url
  })
}

async function downloadOra() {
  const layout = activeLayout.value
  if (!layout) return
  const scale = 2400 / layout.height
  const width = Math.round(layout.width * scale)
  const height = 2400
  const layers = []
  if (settings.dialogueBoxes) layers.push({ name: 'Dialogue boxes', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}">${dialogueMarkup(layout, { dialogue: true, dialogueStyle: settings.dialogueStyle, dialogueDensity: settings.dialogueDensity })}</svg>` })
  if (settings.guide) layers.push({ name: 'Inner guide', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}"><rect x="${layout.inner.x0}" y="${layout.inner.y0}" width="${layout.inner.x1 - layout.inner.x0}" height="${layout.inner.y1 - layout.inner.y0}" fill="none" stroke="#38a5e0" stroke-width="2" stroke-dasharray="8 6" opacity=".7"/></svg>` })
  for (let index = 0; index < layout.panels.length; index += 1) layers.push({ name: `Panel ${String(index + 1).padStart(2, '0')}`, svg: panelLayerSvg(layout, index, settings.lineW) })
  layers.push({ name: 'Background', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}"><rect width="${layout.width}" height="${layout.height}" fill="#fff"/></svg>` })
  const pngLayers = []
  for (const layer of layers) pngLayers.push({ ...layer, png: await renderSvgToPng(layer.svg, width, height) })
  const merged = await renderSvgToPng(svgMarkup(layout, { lineW: settings.lineW, numbers: settings.numbers, dialogue: settings.dialogueBoxes }), width, height)
  const thumbnailWidth = Math.min(256, width)
  const thumbnail = await renderSvgToPng(svgMarkup(layout, { lineW: settings.lineW, numbers: false, dialogue: settings.dialogueBoxes }), thumbnailWidth, Math.round(thumbnailWidth * height / width))
  const stackChildren = pngLayers.map((layer, index) => `<layer name="${layer.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" src="data/${String(index).padStart(3, '0')}.png" x="0" y="0" visibility="visible" opacity="1"/>`).join('')
  const stack = `<?xml version="1.0" encoding="UTF-8"?><image version="0.0.1" w="${width}" h="${height}"><stack name="Manga Layout">${stackChildren}</stack></image>`
  const archive = zipSync({
    mimetype: strToU8('image/openraster'),
    'stack.xml': strToU8(stack),
    'mergedimage.png': merged,
    'Thumbnails/thumbnail.png': thumbnail,
    ...Object.fromEntries(pngLayers.map((layer, index) => [`data/${String(index).padStart(3, '0')}.png`, layer.png])),
  }, { level: 6 })
  downloadBlob(new Blob([archive], { type: 'image/openraster' }), filename(layout, 'ora'))
}

function renderLayouts() {
  const config = readConfig()
  const seed = settings.seed.trim() || 'SC'
  if (mode.value === 'mutate' && baseGenome.value) {
    const next = [{ seed: baseLabel.value, genome: clone(baseGenome.value), isBase: true, ...realize(baseGenome.value, config) }]
    for (let index = 1; index < config.count; index += 1) {
      const random = mulberry32(strHash(`${seed}~${index}`))
      const genome = mutate(baseGenome.value, random, settings.mutation / 100)
      next.push({ seed: `${seed}~${index}`, genome, ...realize(genome, config) })
    }
    layouts.value = next
  } else {
    layouts.value = Array.from({ length: config.count }, (_, index) => generate(`${seed}#${index + 1}`, config))
  }
  currentIndex.value = Math.min(currentIndex.value, layouts.value.length - 1)
}

function selectPreset(name) {
  const preset = PRESETS[name]
  settings.preset = name
  settings.tilt = preset.tilt
  settings.bleed = preset.bleed
  settings.nest = preset.nest
  settings.big = preset.big
  settings.rows = preset.rows
  renderLayouts()
}

function clearPreset() {
  settings.preset = ''
}

function randomSeed() {
  settings.seed = Math.random().toString(36).slice(2, 8).toUpperCase()
  renderLayouts()
}

function openViewer(index) {
  currentIndex.value = index
  nextTick(() => viewer.value?.showModal())
}

function closeViewer() {
  viewer.value?.close()
}

function fillViewer(direction) {
  if (!layouts.value.length) return
  const length = layouts.value.length
  currentIndex.value = (currentIndex.value + direction + length) % length
}

function enterMutate() {
  if (!activeLayout.value) return
  baseGenome.value = clone(activeLayout.value.genome)
  baseLabel.value = activeLayout.value.seed
  mode.value = 'mutate'
  closeViewer()
  renderLayouts()
}

function exitMutate() {
  mode.value = 'gacha'
  baseGenome.value = null
  baseLabel.value = ''
  renderLayouts()
}

function filename(layout, extension) {
  return `komawari_${layout.seed.replace(/[^\w-]+/g, '-')}.${extension}`
}

function downloadBlob(blob, name) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 5000)
}

function downloadSvg() {
  const layout = activeLayout.value
  if (!layout) return
  downloadBlob(new Blob([svgMarkup(layout, { lineW: settings.lineW, dialogue: settings.dialogueBoxes })], { type: 'image/svg+xml' }), filename(layout, 'svg'))
}

function downloadPng() {
  const layout = activeLayout.value
  if (!layout) return
  const url = URL.createObjectURL(new Blob([svgMarkup(layout, { lineW: settings.lineW, dialogue: settings.dialogueBoxes })], { type: 'image/svg+xml' }))
  const image = new Image()
  image.onload = () => {
    const scale = 2400 / layout.height
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(layout.width * scale)
    canvas.height = 2400
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename(layout, 'png'))
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  image.src = url
}

const activeLayout = computed(() => layouts.value[currentIndex.value])
const currentMeta = computed(() => {
  const layout = activeLayout.value
  if (!layout) return ''
  return `#${currentIndex.value + 1}/${layouts.value.length}${layout.isBase ? ' [ベース]' : ''} ・ ${layout.panels.length}コマ ・ seed: ${layout.seed}`
})
const galleryItems = computed(() => layouts.value.map((layout) => ({
  ...layout,
  markup: svgMarkup(layout, { lineW: settings.lineW, guide: settings.guide, numbers: settings.numbers, dialogue: settings.dialogueBoxes }),
})))

function polygonArea(points) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0) / 2)
}

function layoutDecisionFeatures(layout) {
  const areas = layout.panels.map((panel) => polygonArea(panel.pts))
  const totalArea = areas.reduce((sum, area) => sum + area, 0) || 1
  const shares = areas.map((area) => area / totalArea)
  const tilts = [
    ...(layout.genome?.rowTilt || []),
    ...(layout.genome?.rows || []).flatMap((row) => row.colTilt || []),
  ]
  const nestedPanels = (layout.genome?.rows || []).reduce((sum, row) => sum + row.panels.filter((panel) => panel.nest).length, 0)
  const bleedEdges = (layout.genome?.rows || []).reduce((sum, row) => sum + row.panels.reduce((panelSum, panel) => panelSum + ['bT', 'bB', 'bR', 'bL'].filter((edge) => panel[edge]).length, 0), 0)
  return {
    rowCount: layout.genome?.rows?.length || 1,
    largestPanelShare: Math.max(...shares, 0),
    smallestPanelShare: Math.min(...shares),
    firstPanelShare: shares[0] || 0,
    lastPanelShare: shares[shares.length - 1] || 0,
    hierarchy: Math.max(...shares, 0) - Math.min(...shares, 0),
    tilt: Math.min(1, tilts.reduce((sum, value) => sum + Math.abs(value), 0) / Math.max(1, tilts.length)),
    nestedPanels,
    bleedEdges,
  }
}

const storyCandidates = computed(() => layouts.value.map((layout, index) => ({
  index,
  panelCount: layout.panels.length,
  seed: layout.seed,
  ratio: layout.width / layout.height,
  mode: mode.value === 'mutate' ? 'mutation' : settings.preset || 'standard',
  ...layoutDecisionFeatures(layout),
})))

function t(key) {
  return COPY[language.value]?.[key] || COPY.en[key] || key
}

function setWorkspace(view) {
  workspace.value = view
  const url = new URL(window.location.href)
  url.searchParams.set('view', view)
  window.history.replaceState({}, '', url)
}

function openTipsTab() {
  window.open(`${window.location.origin}${window.location.pathname}?view=tips`, '_blank', 'noopener')
}

function storyPayload() {
  return {
    ...storyboard,
    language: language.value,
    dialogueDensity: storyboard.dialogueDensity,
    candidates: storyCandidates.value,
  }
}

function localStoryFallback() {
  const candidates = storyCandidates.value
  const selected = candidates.reduce((best, item) => Math.abs(item.panelCount - storyboard.desiredPanels) < Math.abs(best.panelCount - storyboard.desiredPanels) ? item : best, candidates[0])
  const count = selected?.panelCount || storyboard.desiredPanels
  return {
    selectedLayoutIndex: selected?.index || 0,
    selectedSeed: selected?.seed || '',
    decisionModel: 'browser-fallback',
    reasoning: 'The Worker API was unavailable, so the closest panel-count layout was selected locally.',
    summary: `${storyboard.title || 'Untitled sequence'}: ${storyboard.plot || 'Build a clear visual turn.'}`,
    storyBoxes: Array.from({ length: count }, (_, index) => ({
      panelNumber: index + 1,
      beat: ['Establish', 'Pressure', 'Choice', 'Escalation', 'Turn', 'Consequence'][index % 6],
      shot: index % 3 === 0 ? 'wide establishing shot' : index % 3 === 1 ? 'medium interaction shot' : 'close-up reaction',
      action: 'Advance the story without inventing a new plot fact.',
      dialogue: storyboard.dialogueDensity === 'none' ? '' : 'A concise line that clarifies intent.',
      emotion: index < count / 2 ? 'anticipation' : 'resolve',
      background: storyboard.setting || 'Keep the established setting visible.',
      camera: index % 3 === 0 ? 'wide, eye-level' : index % 3 === 1 ? 'medium, over-shoulder' : 'tight close-up',
      prompt: `Manga panel ${index + 1}; ${storyboard.characters || 'the point-of-view character'}; ${storyboard.setting || 'the established setting'}; ${storyboard.style || 'clear manga staging'}; preserve continuity, silhouettes, right-to-left reading order, and no text rendering artifacts.`,
    })),
  }
}

async function generateStoryboard() {
  storyboardLoading.value = true
  storyboardError.value = ''
  try {
    const response = await fetch('/api/storyboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(storyPayload()),
    })
    if (!response.ok) throw new Error(`Worker responded ${response.status}`)
    storyboardResult.value = await response.json()
  } catch (error) {
    storyboardResult.value = localStoryFallback()
    storyboardError.value = `${error.message}. ${t('noAi')}`
  } finally {
    storyboardLoading.value = false
  }
}

const LOCAL_TIPS = {
  tension: ['Tighten the margins and mix in a tall panel that traps the eye.', 'Shorten dialogue and place a silent panel immediately before the line.', 'Slightly break the horizon so the reader loses a stable footing.'],
  relief: ['Give the eye one large panel where it can breathe.', 'Open the background around the subject and leave visible air.', 'Use calmer horizontal divisions to slow the reading pace.'],
  intimacy: ['Chain smaller panels into a conversational rhythm.', 'Keep both eye-lines at a shared height to hold their distance.', 'Pull bubbles inward and let the gutter become the pause between voices.'],
  shock: ['Drop in a near-splash panel without warning.', 'Withhold information just before the reveal, then open the silhouette wide.', 'Use one diagonal boundary only; reserve it for the moment reality tilts.'],
}

async function getTips() {
  tipLoading.value = true
  try {
    const response = await fetch('/api/emotional-tips', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: language.value, emotion: tipEmotion.value, scene: tipScene.value }),
    })
    if (!response.ok) throw new Error(`Worker responded ${response.status}`)
    tipResult.value = await response.json()
  } catch {
    tipResult.value = { emotion: tipEmotion.value, title: tipEmotion.value, scene: tipScene.value, tips: LOCAL_TIPS[tipEmotion.value], source: 'browser-fallback' }
  } finally {
    tipLoading.value = false
  }
}

function chooseStoryboardLayout() {
  if (Number.isInteger(storyboardResult.value?.selectedLayoutIndex)) {
    setWorkspace('layout')
    openViewer(storyboardResult.value.selectedLayoutIndex)
  }
}

watch(() => [settings.dialogueBoxes, settings.dialogueStyle, settings.dialogueDensity], renderLayouts)
watch(language, (value) => {
  storyboard.language = value
  document.documentElement.lang = value === 'zh' ? 'zh-CN' : value
})
function onKeydown(event) {
  if (!viewer.value?.open) return
  if (event.key === 'ArrowLeft') fillViewer(-1)
  if (event.key === 'ArrowRight') fillViewer(1)
}

watch(() => [settings.ratio, settings.count, settings.numbers, settings.guide], renderLayouts)
watch(() => settings.rows, renderLayouts)
watch(() => [settings.tilt, settings.bleed, settings.nest, settings.big], renderLayouts)
watch(() => settings.lineW, renderLayouts)
watch(() => settings.mutation, renderLayouts)

onMounted(() => {
  document.documentElement.lang = language.value === 'zh' ? 'zh-CN' : language.value
  renderLayouts()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <header>
    <div class="hwrap">
      <div>
        <span class="eyebrow">PANEL LAYOUT GACHA</span>
        <h1>{{ t('title') }}</h1>
      </div>
      <span class="hdesc">{{ t('desc') }}</span>
      <div class="header-actions">
        <label class="lang-control">Language
          <select v-model="language" aria-label="Language">
            <option v-for="item in LANGUAGES" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <button class="ghost" type="button" @click="setWorkspace('storyboard')">{{ t('storyboard') }}</button>
        <button class="ghost" type="button" @click="openTipsTab">{{ t('openTips') }}</button>
      </div>
    </div>
  </header>

  <main>
    <nav class="workspace-tabs" aria-label="Workspace">
      <button type="button" :class="{ active: workspace === 'layout' }" @click="setWorkspace('layout')">{{ t('layout') }}</button>
      <button type="button" :class="{ active: workspace === 'storyboard' }" @click="setWorkspace('storyboard')">{{ t('storyboard') }}</button>
      <button type="button" :class="{ active: workspace === 'tips' }" @click="setWorkspace('tips')">{{ t('tips') }}</button>
      <button class="tab-external" type="button" @click="openTipsTab">{{ t('newTab') }} ↗</button>
    </nav>

    <section v-if="workspace === 'layout'" aria-label="Layout generator">
      <section class="controls" :aria-label="t('settings')">
        <div class="row chips gachactl" :class="{ muted: mode === 'mutate' }">
          <button v-for="(preset, name) in PRESETS" :key="name" :class="{ on: settings.preset === name }" type="button" @click="selectPreset(name)">
            {{ name === 'seizen' ? (language === 'en' ? 'Calm dialogue' : language === 'zh' ? '整齐·对话' : '整然・会話') : name === 'std' ? (language === 'en' ? 'Standard' : language === 'zh' ? '标准' : '標準') : name === 'action' ? (language === 'en' ? 'Action' : language === 'zh' ? '动作' : 'アクション') : (language === 'en' ? 'Splash / title' : language === 'zh' ? '大特写·扉页' : '見せゴマ・扉') }}
          </button>
        </div>

        <div class="row">
          <label class="sel">{{ t('panelLayout') }}
            <select v-model="settings.ratio" :aria-label="t('panelLayout')">
              <option value="0.708">B5 / A5</option>
              <option value="0.8">SNS 4:5</option>
              <option value="1">1:1</option>
            </select>
          </label>
          <label class="sel gachactl" :class="{ muted: mode === 'mutate' }">{{ t('rows') }}
            <select v-model="settings.rows" :aria-label="t('rows')" @change="clearPreset">
              <option value="1-2">1–2</option><option value="1-3">1–3</option><option value="2-3">2–3</option><option value="2-4">2–4</option><option value="3-4">3–4</option>
            </select>
          </label>
          <label v-for="item in [['tilt', language === 'en' ? 'Tilt' : language === 'zh' ? '斜格' : '斜めコマ'], ['bleed', language === 'en' ? 'Bleed' : language === 'zh' ? '出血' : '断ち切り'], ['nest', language === 'en' ? 'Nested split' : language === 'zh' ? '格内分割' : 'コマ内分割'], ['big', language === 'en' ? 'Large panel' : language === 'zh' ? '大格比例' : '大ゴマ率']]" :key="item[0]" class="sld gachactl" :class="{ muted: mode === 'mutate' }">
            <span class="nm">{{ item[1] }}<output>{{ settings[item[0]] }}</output></span>
            <input v-model.number="settings[item[0]]" type="range" min="0" max="100" :aria-label="item[1]" @input="clearPreset" />
          </label>
          <label class="sld"><span class="nm">{{ t('line') }}<output>{{ settings.lineW }}</output></span><input v-model.number="settings.lineW" type="range" min="2" max="10" :aria-label="t('line')" /></label>
          <label class="sel">{{ t('count') }}<select v-model.number="settings.count" :aria-label="t('count')"><option :value="12">12</option><option :value="24">24</option><option :value="48">48</option></select></label>
        </div>

        <div class="row">
          <label class="sel">{{ t('seed') }} <input v-model="settings.seed" class="mono" type="text" spellcheck="false" aria-label="seed" @change="renderLayouts" /></label>
          <button class="btn" type="button" @click="randomSeed">🎲 {{ t('roll') }}</button>
          <label class="chk"><input v-model="settings.numbers" type="checkbox" />{{ t('numbers') }}</label>
          <label class="chk"><input v-model="settings.guide" type="checkbox" />{{ t('guide') }}</label>
          <label class="chk"><input v-model="settings.dialogueBoxes" type="checkbox" />{{ t('dialogue') }}</label>
          <label class="sel">{{ t('dialogueStyle') }}<select v-model="settings.dialogueStyle" :aria-label="t('dialogueStyle')"><option value="mixed">Mixed / 混合</option><option value="speech">Speech / 对话</option><option value="whisper">Whisper / 低语</option><option value="shout">Shout / 喊叫</option><option value="thought">Thought / 内心</option><option value="caption">Caption / 旁白</option></select></label>
          <label class="sld dialogue-density"><span class="nm">{{ t('dialogueDensity') }}<output>{{ settings.dialogueDensity }}</output></span><input v-model.number="settings.dialogueDensity" type="range" min="0" max="100" :aria-label="t('dialogueDensity')" /></label>
        </div>

        <div v-if="mode === 'mutate'" class="row mutbar">
          <span class="mutlabel">🧬 {{ t('mutation') }} — <b>{{ baseLabel }}</b></span>
          <label class="sld"><span class="nm">{{ t('mutation') }}<output>{{ settings.mutation }}</output></span><input v-model.number="settings.mutation" type="range" min="5" max="100" :aria-label="t('mutation')" /></label>
          <button class="ghost" type="button" @click="exitMutate">⟲ {{ language === 'en' ? 'Back to bundle' : language === 'zh' ? '返回布局' : 'ガチャに戻る' }}</button>
        </div>
      </section>

      <div class="gallery">
        <button v-for="(layout, index) in galleryItems" :key="`${layout.seed}-${index}`" class="card" :class="{ base: layout.isBase }" type="button" :aria-label="`${t('preview')} ${index + 1}`" @click="openViewer(index)">
          <div class="page" v-html="layout.markup"></div>
          <div class="cap"><span class="mono">{{ layout.isBase ? 'BASE' : `#${String(index + 1).padStart(2, '0')}` }}</span><span>{{ layout.panels.length }} panels</span></div>
        </button>
      </div>

      <footer>
        <details open>
          <summary>{{ language === 'en' ? 'Workflow notes' : language === 'zh' ? '使用说明' : '使い方 — クリスタ・GIMPへ' }}</summary>
          <p>{{ language === 'en' ? 'Use PNG as a guide layer, SVG as vector frames, or ORA to keep one layer per panel in GIMP/Krita.' : language === 'zh' ? 'PNG 可作为辅助层，SVG 可作为矢量边框，ORA 会在 GIMP/Krita 中保留每格独立图层。' : 'PNGを下敷きにし、SVGをベクター枠として、ORAをGIMP/Kritaのレイヤー付き下書きとして使えます。' }}</p>
          <p>{{ t('gimpNote') }}</p>
        </details>
      </footer>
    </section>

    <section v-else-if="workspace === 'storyboard'" class="storyboard-workspace" aria-label="AI storyboard">
      <div class="workspace-heading">
        <div><span class="eyebrow">CONTEXT → LAYOUT → PROMPTS</span><h2>{{ t('storyboardTitle') }}</h2><p>{{ t('storyboardDesc') }}</p></div>
        <span class="model-badge">{{ t('decision') }}</span>
      </div>
      <form class="story-form" @submit.prevent="generateStoryboard">
        <label class="field wide">{{ t('world') }}<textarea v-model="storyboard.world" rows="3" :placeholder="language === 'en' ? 'Culture, rules, geography, visual motifs…' : language === 'zh' ? '文化、规则、地理、视觉母题…' : '文化・ルール・地理・視覚モチーフ…'"></textarea></label>
        <label class="field">{{ t('chapter') }}<textarea v-model="storyboard.chapter" rows="3"></textarea></label>
        <label class="field">{{ t('plot') }}<textarea v-model="storyboard.plot" rows="3"></textarea></label>
        <label class="field wide">{{ t('events') }}<textarea v-model="storyboard.events" rows="4" :placeholder="language === 'en' ? 'One event per line: inciting event, escalation, reversal, consequence…' : language === 'zh' ? '每行一个事件：起因、升级、反转、后果…' : '発端・加速・反転・結果を1行ずつ…'"></textarea></label>
        <label class="field">{{ t('setting') }}<textarea v-model="storyboard.setting" rows="3"></textarea></label>
        <label class="field">{{ t('characters') }}<textarea v-model="storyboard.characters" rows="3"></textarea></label>
        <label class="field">{{ t('style') }}<textarea v-model="storyboard.style" rows="3"></textarea></label>
        <label class="field compact">{{ t('desiredPanels') }}<input v-model.number="storyboard.desiredPanels" type="number" min="3" max="24" /></label>
        <label class="field compact">{{ t('dialogueDensity') }}<select v-model="storyboard.dialogueDensity"><option value="none">None</option><option value="light">Light</option><option value="balanced">Balanced</option><option value="dense">Dense</option></select></label>
        <label class="field compact">Temperature <input v-model.number="storyboard.temperature" type="number" min="0" max="1" step=".05" /></label>
        <label class="field compact">Max tokens <input v-model.number="storyboard.maxTokens" type="number" min="600" max="3200" step="100" /></label>
        <label class="field wide">{{ t('promptTemplate') }}<textarea v-model="storyboard.promptTemplate" rows="4"></textarea><small>{{ t('promptHelp') }}</small></label>
        <div class="story-actions wide"><button class="btn" type="submit" :disabled="storyboardLoading">{{ storyboardLoading ? t('generating') : t('generate') }}</button><span class="note">{{ t('noAi') }}</span></div>
      </form>

      <p v-if="storyboardError" class="inline-error">{{ storyboardError }}</p>
      <section v-if="storyboardResult" class="story-result">
        <div class="result-summary">
          <div><span class="eyebrow">DECISION OUTPUT</span><h3>{{ storyboardResult.summary }}</h3><p>{{ storyboardResult.reasoning }}</p></div>
          <button class="btn sub" type="button" @click="chooseStoryboardLayout">{{ language === 'en' ? 'Open selected layout' : language === 'zh' ? '打开选中布局' : '選択した割りを開く' }} ↗</button>
        </div>
-        <div class="story-meta"><span class="mono">{{ storyboardResult.decisionModel }}</span><span>{{ storyboardResult.storyBoxes?.length }} {{ language === 'en' ? 'boxes' : language === 'zh' ? '格' : 'コマ' }}</span></div>
+        <div class="story-meta"><span class="mono">{{ storyboardResult.decisionModel }}</span><span>{{ t('scenario') }}: {{ storyboardResult.scenario }}</span><span>{{ t('confidence') }}: {{ Math.round((storyboardResult.confidence || 0) * 100) }}%</span><span>{{ storyboardResult.storyBoxes?.length }} {{ language === 'en' ? 'boxes' : language === 'zh' ? '格' : 'コマ' }}</span></div>
+        <div v-if="storyboardResult.rankedLayouts?.length" class="ranked-layouts"><span class="eyebrow">{{ t('ranked') }}</span><span v-for="candidate in storyboardResult.rankedLayouts" :key="candidate.index" class="ranked-chip">#{{ candidate.index + 1 }} · {{ Math.round(candidate.fit * 100) }}% · {{ candidate.reason }}</span></div>
        <article v-for="box in storyboardResult.storyBoxes" :key="box.panelNumber" class="story-box">
          <div class="box-index mono">{{ String(box.panelNumber).padStart(2, '0') }}</div>
          <div class="box-body"><h4>{{ t('storyBox') }} {{ box.panelNumber }} · {{ box.beat }}</h4><p><b>{{ t('emotion') }}:</b> {{ box.emotion }} · <b>{{ t('camera') }}:</b> {{ box.camera }} · <b>{{ t('background') }}:</b> {{ box.background }}</p><p>{{ box.action }}</p><p v-if="box.dialogue" class="dialogue-copy">“{{ box.dialogue }}”</p><label class="prompt-label">{{ t('prompt') }}<textarea :value="box.prompt" rows="4" readonly></textarea></label></div>
        </article>
      </section>
    </section>

    <section v-else class="tips-workspace" aria-label="Emotional tips">
      <div class="workspace-heading"><div><span class="eyebrow">RHYTHM / EMOTION / SPACE</span><h2>{{ t('emotionTips') }}</h2><p>{{ language === 'en' ? 'Use emotion as a layout constraint: panel scale, gutters, camera distance, and dialogue density all carry feeling.' : language === 'zh' ? '把情绪当作布局约束：格子大小、格间、镜头距离和对白密度都会传达感觉。' : '感情をレイアウトの制約として扱います。コマの大小・間・距離・台詞密度が感情を運びます。' }}</p></div><button class="ghost" type="button" @click="openTipsTab">{{ t('newTab') }} ↗</button></div>
      <div class="tip-controls"><label class="field">{{ t('emotion') }}<select v-model="tipEmotion"><option value="tension">Tension / 緊張 / 紧张</option><option value="relief">Relief / 安堵 / 释然</option><option value="intimacy">Intimacy / 親密 / 亲密</option><option value="shock">Shock / 衝撃 / 冲击</option></select></label><label class="field wide">{{ t('emotionScene') }}<textarea v-model="tipScene" rows="3" :placeholder="language === 'en' ? 'What is happening in this scene?' : language === 'zh' ? '这个场景正在发生什么？' : 'この場面で何が起きていますか？'"></textarea></label><button class="btn" type="button" :disabled="tipLoading" @click="getTips">{{ tipLoading ? t('generating') : t('getTips') }}</button></div>
      <section v-if="tipResult" class="tip-result"><h3>{{ tipResult.title }}</h3><p class="note">{{ tipResult.scene }}</p><ol><li v-for="tip in tipResult.tips" :key="tip">{{ tip }}</li></ol></section>
      <div v-else class="empty-state">{{ language === 'en' ? 'Choose an emotional beat to get layout guidance.' : language === 'zh' ? '选择一个情绪节拍以获得布局建议。' : '感情のビートを選ぶとレイアウトのヒントが出ます。' }}</div>
    </section>
  </main>

  <dialog ref="viewer" class="viewer" :aria-label="t('preview')" @click.self="closeViewer">
    <div class="vhead"><span class="meta mono">{{ currentMeta }}</span><span class="sp"></span><button class="ghost close" type="button" :aria-label="language === 'en' ? 'Close' : language === 'zh' ? '关闭' : '閉じる'" @click="closeViewer">✕</button></div>
    <div v-if="activeLayout" class="vpage" :style="{ '--r': (activeLayout.width / activeLayout.height).toFixed(4) }"><div v-html="svgMarkup(activeLayout, { lineW: settings.lineW, numbers: settings.numbers, dialogue: settings.dialogueBoxes })"></div></div>
    <div class="vfoot"><button class="ghost" type="button" @click="fillViewer(-1)">◀</button><span class="sp"></span><button class="btn sub" type="button" @click="enterMutate">🧬 {{ t('mutate') }}</button><button class="btn" type="button" @click="downloadSvg">{{ t('svg') }}</button><button class="btn" type="button" @click="downloadPng">{{ t('png') }}</button><button class="btn" type="button" @click="downloadOra">{{ t('ora') }}</button><span class="sp"></span><button class="ghost" type="button" @click="fillViewer(1)">▶</button></div>
  </dialog>
</template>
