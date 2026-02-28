import { styleText } from 'node:util'
import type { UsageData } from './usage.ts'

const YELLOW_THRESHOLD = 75
const RED_THRESHOLD = 90

const MODEL_NAME_WIDTH = 22
const MODEL_USAGE_COUNT_WIDTH = 5
const MODEL_USAGE_PCT_WIDTH = 7

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function dim(text: string): string {
  return styleText('dim', text)
}

function getColor(percentage: number): 'green' | 'yellow' | 'red' {
  if (percentage < YELLOW_THRESHOLD) return 'green'
  if (percentage < RED_THRESHOLD) return 'yellow'
  return 'red'
}

function formatPercentage(pct: number): string {
  if (pct >= 1000) return `${(pct / 1000).toFixed(1)}k%`
  return `${pct.toFixed(1)}%`
}

function drawBar(used: number, total: number, width: number): string {
  const maxxed = Math.min(used, total)
  const filled = Math.floor((maxxed * width) / total)
  const color = getColor((used / total) * 100)
  const empty = width - filled
  return styleText(color, '█'.repeat(filled)) + dim('░'.repeat(empty))
}

function drawMonthProgressBar(
  currentDay: number,
  totalDays: number,
  width: number,
): string {
  const filled = Math.min(
    Math.floor((currentDay * width) / totalDays),
    width - 1,
  )
  const empty = width - filled - 1
  return dim('⋅'.repeat(filled)) + '|' + dim('⋅'.repeat(empty))
}

function drawBoxTop(width: number): string {
  return dim('┌─' + '─'.repeat(width) + '─┐')
}

function drawBoxSeparator(width: number): string {
  return dim('├─' + '─'.repeat(width) + '─┤')
}

function drawBoxBottom(width: number): string {
  return dim('└─' + '─'.repeat(width) + '─┘')
}

function printBoxLine(text: string, width: number): string {
  const textW = Bun.stringWidth(text)
  const padding = Math.floor((width - textW) / 2)
  const rightPad = width - textW - padding
  return (
    dim('│ ') + ' '.repeat(padding) + text + ' '.repeat(rightPad) + dim(' │')
  )
}

function printBoxLeft(text: string, width: number): string {
  const textW = Bun.stringWidth(text)
  const rightPad = width - textW
  return dim('│ ') + text + ' '.repeat(Math.max(0, rightPad)) + dim(' │')
}

export type RenderOptions = {
  width: number
}

export function renderDisplay(
  data: UsageData,
  plan: string,
  limit: number,
  { width }: RenderOptions,
): string {
  const boxOuterWidth = width
  const boxInnerWidth = boxOuterWidth - 4
  const largeBarWidth = boxInnerWidth - 10
  const smallBarWidth =
    boxInnerWidth -
    MODEL_NAME_WIDTH -
    MODEL_USAGE_COUNT_WIDTH -
    MODEL_USAGE_PCT_WIDTH -
    2

  const {
    username,
    year,
    monthName,
    totalUsage,
    modelCounts,
    currentDay,
    daysInMonth,
    nextResetDate,
  } = data

  const percentage = (totalUsage / limit) * 100
  const color = getColor(percentage)

  const nextMonthName = nextResetDate.toLocaleString('en-US', { month: 'long' })
  const nextYear = nextResetDate.getFullYear()

  const center = (text: string) => printBoxLine(text, boxInnerWidth)
  const left = (text: string) => printBoxLeft(text, boxInnerWidth)

  const hasUsage = Array.from(modelCounts.values()).some((count) => count > 0)
  let modelLines: string

  if (!hasUsage) {
    modelLines = left('No premium requests used yet.')
  } else {
    const modelsSorted = Array.from(modelCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    )
    const lines: string[] = []
    for (const [model, modelCount] of modelsSorted) {
      if (modelCount === 0) continue

      const modelPct = formatPercentage((modelCount / limit) * 100)
      let modelDisplay = model
      if (model.length > MODEL_NAME_WIDTH) {
        modelDisplay = model.substring(0, MODEL_NAME_WIDTH - 1) + '…'
      }

      const smallBar = drawBar(modelCount, limit, smallBarWidth)
      const modelLine = `${modelDisplay.padEnd(MODEL_NAME_WIDTH)}${String(Math.round(modelCount)).padStart(MODEL_USAGE_COUNT_WIDTH)} ${smallBar} ${modelPct.padStart(MODEL_USAGE_PCT_WIDTH)}`
      lines.push(left(modelLine))
    }
    modelLines = lines.join('\n')
  }

  return [
    drawBoxTop(boxInnerWidth),
    center(''),
    center(`GitHub Copilot ${toTitleCase(plan)} - Premium Requests Usage`),
    center(`${monthName} ${year} • ${username}`),
    center(''),
    drawBoxSeparator(boxInnerWidth),
    left(
      `Overall:  ${styleText('bold', totalUsage.toString())}${dim('/' + limit + ' (')}${styleText([color, 'bold'], percentage.toFixed(1) + '%')}${dim(')')}`,
    ),
    left(`Usage:    ${drawBar(totalUsage, limit, largeBarWidth)}`),
    left(
      `Month:    ${drawMonthProgressBar(currentDay, daysInMonth, largeBarWidth)}`,
    ),
    center(''),
    left(
      styleText(
        color === 'green' ? 'dim' : color,
        `Resets:   ${nextMonthName} 1, ${nextYear} at 00:00 UTC`,
      ),
    ),
    drawBoxSeparator(boxInnerWidth),
    left(dim('Per-model usage:')),
    center(''),
    modelLines,
    center(''),
    drawBoxBottom(boxInnerWidth),
    '',
  ].join('\n')
}
