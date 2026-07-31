import { styleText } from 'node:util'
import type { UsageData } from './usage.ts'

const MODEL_NAME_WIDTH = 22
const MODEL_USAGE_COUNT_WIDTH = 8
const MODEL_USAGE_PCT_WIDTH = 7

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function dim(text: string): string {
  return styleText('dim', text)
}

export function getOverallColor(
  percentage: number,
  monthProgress: number,
): 'green' | 'yellow' | 'red' {
  const usageRatio = percentage / 100
  // Half-way point between monthProgress & endOfMonth
  const redThreshold = (1 + monthProgress) / 2
  if (usageRatio < monthProgress) return 'green'
  if (usageRatio < redThreshold) return 'yellow'
  return 'red'
}

export function getModelColor(percentage: number): 'green' | 'yellow' | 'red' {
  if (percentage < 75) return 'green'
  if (percentage < 90) return 'yellow'
  return 'red'
}

function formatPercentage(pct: number): string {
  if (Math.abs(pct) < 1000) return `${pct.toFixed(1)}%`

  const absolute = Math.abs(pct)
  const [divisor, suffix] =
    absolute >= 1_000_000_000_000_000
      ? [1_000_000_000_000_000, 'q']
      : absolute >= 1_000_000_000_000
        ? [1_000_000_000_000, 't']
        : absolute >= 1_000_000_000
          ? [1_000_000_000, 'b']
          : absolute >= 1_000_000
            ? [1_000_000, 'm']
            : [1000, 'k']
  return `${Number((pct / divisor).toPrecision(2))}${suffix}%`
}

function formatUsageAmount(amount: number): string {
  const absolute = Math.abs(amount)
  const [divisor, suffix] =
    absolute >= 1_000_000_000_000
      ? [1_000_000_000_000, 't']
      : absolute >= 1_000_000_000
        ? [1_000_000_000, 'b']
        : absolute >= 1_000_000
          ? [1_000_000, 'm']
          : absolute >= 100_000
            ? [1000, 'k']
            : [1, '']
  return (
    (amount / divisor)
      .toFixed(2)
      .replace(/\.00$/, '')
      .replace(/(\.\d)0$/, '$1') + suffix
  )
}

function formatNarrowAmount(amount: number): string {
  if (Math.abs(amount) < 100) return Number(amount.toFixed(0)).toString()

  const units = [
    [1000, 'k'],
    [1_000_000, 'm'],
    [1_000_000_000, 'b'],
    [1_000_000_000_000, 't'],
    [1_000_000_000_000_000, 'q'],
  ] as const
  let unitIndex = units.findLastIndex(([divisor]) => Math.abs(amount) >= divisor)
  unitIndex = Math.max(0, unitIndex)

  let [divisor, suffix] = units[unitIndex] ?? units[0]
  let value = Number((amount / divisor).toPrecision(1))
  if (Math.abs(value) >= 1000 && unitIndex < units.length - 1) {
    const nextUnit = units[unitIndex + 1] ?? units[unitIndex] ?? units[0]
    divisor = nextUnit[0]
    suffix = nextUnit[1]
    value = Number((amount / divisor).toPrecision(1))
  }
  return `${value}${suffix}`
}

function clampRepeatCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0
  return Math.floor(count)
}

function clampCurrentDay(currentDay: number, totalDays: number): number {
  if (!(totalDays > 0)) return 0
  return Math.min(Math.max(currentDay, 0), totalDays)
}

function drawBar(
  used: number,
  total: number,
  width: number,
  color: 'green' | 'yellow' | 'red',
): string {
  if (width <= 0 || total <= 0) return ''
  const maxxed = Math.min(Math.max(used, 0), total)
  const filled = clampRepeatCount((maxxed * width) / total)
  const empty = width - filled
  return styleText(color, '█'.repeat(filled)) + dim('░'.repeat(empty))
}

function drawMonthProgressBar(
  currentDay: number,
  totalDays: number,
  width: number,
): string {
  if (width <= 0) return ''
  const day = clampCurrentDay(currentDay, totalDays)
  const filled =
    totalDays > 0 ? clampRepeatCount((day * width) / totalDays) : 0
  const cursor = Math.min(filled, width - 1)
  const empty = width - cursor - 1
  return dim('⋅'.repeat(cursor)) + '|' + dim('⋅'.repeat(empty))
}

function drawBoxTop(width: number): string {
  return dim('╭─' + '─'.repeat(width) + '─╮')
}

function drawBoxSeparator(width: number): string {
  return dim('├─' + '─'.repeat(width) + '─┤')
}

function drawBoxBottom(width: number): string {
  return dim('╰─' + '─'.repeat(width) + '─╯')
}

function printBoxLine(text: string, width: number): string {
  const fittedText = fitText(text, width)
  const textW = Bun.stringWidth(fittedText)
  const padding = Math.floor((width - textW) / 2)
  const rightPad = width - textW - padding
  return (
    dim('│ ') +
    ' '.repeat(padding) +
    fittedText +
    ' '.repeat(rightPad) +
    dim(' │')
  )
}

function fitText(text: string, width: number): string {
  if (Bun.stringWidth(text) <= width) return text

  let fitted = ''
  for (const character of text) {
    if (Bun.stringWidth(fitted + character + '…') > width) break
    fitted += character
  }
  return fitted + '…'
}

function printBoxLeft(text: string, width: number): string {
  const textW = Bun.stringWidth(text)
  const rightPad = width - textW
  return dim('│ ') + text + ' '.repeat(Math.max(0, rightPad)) + dim(' │')
}

function printBoxLeftRight(
  leftText: string,
  rightText: string,
  width: number,
): string {
  const leftW = Bun.stringWidth(leftText)
  const rightW = Bun.stringWidth(rightText)
  const gap = Math.max(1, width - leftW - rightW)
  return dim('│ ') + leftText + ' '.repeat(gap) + rightText + dim(' │')
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function formatTimeUntilReset(
  now: Date,
  resetDate: Date,
): string | null {
  const diffMs = resetDate.getTime() - now.getTime()
  if (diffMs <= 0 || diffMs >= SEVEN_DAYS_MS) return null

  const totalMinutes = Math.floor(diffMs / (60 * 1000))
  const totalHours = Math.floor(diffMs / (60 * 60 * 1000))
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  if (totalHours >= 24) return `in ${days} ${days === 1 ? 'day' : 'days'}`
  if (totalHours >= 12) return `in ${totalHours}h`

  const remainingMinutes = totalMinutes % 60
  if (totalHours === 0) return `in ${remainingMinutes}min`
  return `in ${totalHours}h ${remainingMinutes}min`
}

function renderCompact(data: UsageData, plan: string, width: number): string {
  const unit = data.billingUnit === 'ai-credits' ? 'credits' : 'requests'
  return [
    fitText(`Copilot ${toTitleCase(plan)}`, width),
    fitText(`${formatUsageAmount(data.totalUsage)} ${unit}`, width),
    '',
  ].join('\n')
}

export type RenderOptions = {
  width: number
}

export function renderDisplay(
  data: UsageData,
  plan: string,
  limit: number | null,
  { width: requestedWidth }: RenderOptions,
): string {
  const width = Math.max(1, requestedWidth)
  if (width < 20) return renderCompact(data, plan, width)

  const boxOuterWidth = width
  const boxInnerWidth = boxOuterWidth - 4
  const largeBarWidth = boxInnerWidth - 10
  const modelNameWidth = Math.min(
    MODEL_NAME_WIDTH,
    Math.max(1, boxInnerWidth - MODEL_USAGE_COUNT_WIDTH),
  )
  const smallBarWidth =
    boxInnerWidth -
    modelNameWidth -
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
    now,
    billingUnit,
  } = data
  const usesAiCredits = billingUnit === 'ai-credits'
  const usageTitle = usesAiCredits ? 'AI Credit Usage' : 'Premium Request Usage'
  const emptyUsage =
    width < 40
      ? 'No usage yet.'
      : usesAiCredits
        ? 'No AI credits used yet.'
        : 'No premium requests used yet.'

  const percentage = limit === null ? null : (totalUsage / limit) * 100
  const monthProgress =
    daysInMonth > 0 ? clampCurrentDay(currentDay, daysInMonth) / daysInMonth : 0
  const color =
    percentage === null ? 'green' : getOverallColor(percentage, monthProgress)

  const nextMonthName = nextResetDate.toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  })
  const nextMonthShort = nextResetDate.toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
  const nextYear = nextResetDate.getUTCFullYear()
  const timeUntilReset =
    width >= 60 ? formatTimeUntilReset(now, nextResetDate) : null
  const resetText =
    width < 40
      ? `Reset: ${nextMonthShort} 1`
      : width < 60
        ? `Resets: ${nextMonthName} 1, ${nextYear}`
        : `Resets:   ${nextMonthName} 1, ${nextYear} at 00:00 UTC`
  const resetLabel = styleText(color === 'green' ? 'dim' : color, resetText)

  const center = (text: string) => printBoxLine(text, boxInnerWidth)
  const left = (text: string) => printBoxLeft(text, boxInnerWidth)

  const hasUsage = Array.from(modelCounts.values()).some((count) => count > 0)
  let modelLines: string

  if (!hasUsage) {
    modelLines = left(emptyUsage)
  } else {
    const modelsSorted = Array.from(modelCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    )
    const lines: string[] = []
    for (const [model, modelCount] of modelsSorted) {
      if (modelCount === 0) continue

      const modelDisplay = fitText(model, modelNameWidth)
      const amount = formatUsageAmount(modelCount).padStart(
        MODEL_USAGE_COUNT_WIDTH,
      )
      if (limit === null || smallBarWidth < 1) {
        lines.push(left(`${modelDisplay.padEnd(modelNameWidth)}${amount}`))
        continue
      }

      const modelPctValue = (modelCount / limit) * 100
      const modelPct = formatPercentage(modelPctValue)
      const smallBar = drawBar(
        modelCount,
        limit,
        smallBarWidth,
        getModelColor(modelPctValue),
      )
      const modelLine = `${modelDisplay.padEnd(modelNameWidth)}${amount} ${smallBar} ${modelPct.padStart(MODEL_USAGE_PCT_WIDTH)}`
      lines.push(left(modelLine))
    }
    modelLines = lines.join('\n')
  }

  const amountFormatter = width < 40 ? formatNarrowAmount : formatUsageAmount
  const totalLabel = amountFormatter(totalUsage)
  const limitLabel = limit === null ? null : amountFormatter(limit)
  const overall =
    width < 40
      ? `Used: ${styleText('bold', totalLabel)}${limitLabel === null ? '' : dim('/' + limitLabel)}`
      : limitLabel === null || percentage === null
        ? `Overall:  ${styleText('bold', totalLabel)}${dim(' AI credits')}`
        : `Overall:  ${styleText('bold', totalLabel)}${dim('/' + limitLabel + ' (')}${styleText([color, 'bold'], percentage.toFixed(1) + '%')}${dim(')')}`
  const usage =
    limit === null
      ? []
      : [left(`Usage:    ${drawBar(totalUsage, limit, largeBarWidth, color)}`)]

  return [
    drawBoxTop(boxInnerWidth),
    center(''),
    center(
      `${width < 50 ? 'Copilot' : 'GitHub Copilot'} ${toTitleCase(plan)} - ${usageTitle}`,
    ),
    center(`${monthName} ${year} • ${username}`),
    center(''),
    drawBoxSeparator(boxInnerWidth),
    left(overall),
    ...usage,
    left(
      `Month:    ${drawMonthProgressBar(currentDay, daysInMonth, largeBarWidth)}`,
    ),
    center(''),
    timeUntilReset
      ? printBoxLeftRight(resetLabel, dim(timeUntilReset), boxInnerWidth)
      : left(resetLabel),
    drawBoxSeparator(boxInnerWidth),
    left(dim('Per-model usage:')),
    center(''),
    modelLines,
    center(''),
    drawBoxBottom(boxInnerWidth),
    '',
  ].join('\n')
}
