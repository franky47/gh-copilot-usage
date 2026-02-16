#!/usr/bin/env bun

import { $ } from 'bun'
import { parseArgs, styleText } from 'node:util'
import pkgJson from '../package.json'

const VERSION = pkgJson.version

// Parse command line arguments
function parseCliArgs(): { limit?: number } {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      limit: {
        type: 'string',
        short: 'l',
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
      version: {
        type: 'boolean',
        short: 'v',
      },
    },
    strict: true,
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
GitHub Copilot Premium Requests Usage Tracker v${VERSION}

Usage:
  gh copilot-usage [options]

Options:
  --limit <number>    Set the monthly premium request limit (default: 300)
  --help, -h          Show this help message
  --version, -v       Show version information

Configuration:
  The limit can be configured in multiple ways (in order of priority):
    1. Command line flag: --limit 300
    2. Environment variable: GH_COPILOT_LIMIT=300
    3. gh config: gh config set copilot-usage.limit 300
    4. Default: 300 (GitHub Copilot Pro)

Examples:
  gh copilot-usage
  gh copilot-usage --limit 500
  GH_COPILOT_LIMIT=500 gh copilot-usage
`)
    process.exit(0)
  }

  if (values.version) {
    console.log(`gh-copilot-usage v${VERSION}`)
    process.exit(0)
  }

  let limit: number | undefined
  if (values.limit !== undefined) {
    const value = parseInt(values.limit, 10)
    if (isNaN(value) || value <= 0) {
      console.error('Error: --limit must be a positive number')
      process.exit(1)
    }
    limit = value
  }

  return { limit }
}

// Get limit from various sources (priority: CLI > env > gh config > default)
async function getLimit(cliLimit?: number): Promise<number> {
  // 1. CLI argument (highest priority)
  if (cliLimit !== undefined) {
    return cliLimit
  }

  // 2. Environment variable
  const envLimit = process.env.GH_COPILOT_LIMIT
  if (envLimit !== undefined) {
    const parsed = parseInt(envLimit, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  // 3. gh config
  try {
    const configValue = await $`gh config get copilot-usage.limit`.text()
    const parsed = parseInt(configValue.trim(), 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  } catch {
    // Config not set, continue to default
  }

  // 4. Default (GitHub Copilot Pro)
  return 300
}

const { limit: cliLimit } = parseCliArgs()
const LIMIT = await getLimit(cliLimit)

// Layout
const BOX_OUTER_WIDTH = Math.min(80, process.stdout.columns)
const BOX_INNER_WIDTH = BOX_OUTER_WIDTH - 4 // 1 border + 1 padding on either side
const LARGE_BAR_WIDTH = BOX_INNER_WIDTH - 10 // Leave space for left labels
const MODEL_NAME_WIDTH = 20
const MODEL_USAGE_COUNT_WIDTH = 8 // e.g. "0.33/300"
const MODEL_USAGE_PCT_WIDTH = 6 // e.g. "100.0%"
const SMALL_BAR_WIDTH =
  BOX_INNER_WIDTH -
  MODEL_NAME_WIDTH -
  MODEL_USAGE_COUNT_WIDTH -
  MODEL_USAGE_PCT_WIDTH -
  2 // spacing

type UsageItem = {
  grossQuantity: number
  model?: string
}

type UsageResponse = {
  usageItems?: UsageItem[]
}

// Get current user
const username = (await $`gh api /user -q .login`.text()).trim()

// Get current year and month
const now = new Date()
const year = now.getFullYear()
const month = String(now.getMonth() + 1).padStart(2, '0')
const monthName = now.toLocaleString('en-US', { month: 'long' })

// Fetch usage data
const response =
  (await $`gh api /users/${username}/settings/billing/premium_request/usage?year=${year}\&month=${month}`.json()) as UsageResponse

// Calculate total usage and aggregate by model
const totalUsage = (response.usageItems ?? []).reduce(
  (sum, item) => sum + item.grossQuantity,
  0,
)

const modelCounts = new Map<string, number>()
for (const item of response.usageItems ?? []) {
  const model = item.model ?? 'Unknown'
  modelCounts.set(model, (modelCounts.get(model) ?? 0) + item.grossQuantity)
}

// Calculate percentage
const percentage = (totalUsage / LIMIT) * 100

// Determine color
function getColor(percentage: number) {
  if (percentage < 75) return 'green' as const
  if (percentage < 90) return 'yellow' as const
  return 'red' as const
}
function dim(text: string) {
  return styleText('dim', text)
}

const color = getColor(percentage)

// Draw progress bar
function drawBar(used: number, total: number, width: number): string {
  const filled = Math.floor((used * width) / total)
  const color = getColor((used / total) * 100)
  const empty = width - filled
  return styleText(color, '█'.repeat(filled)) + dim('░'.repeat(empty))
}

// Draw ghost progress bar for month progress
function drawMonthProgressBar(
  currentDay: number,
  totalDays: number,
  width: number,
): string {
  const filled = Math.floor((currentDay * width) / totalDays)
  const empty = width - filled - 1 // -1 for the separator
  return dim('⋅'.repeat(filled)) + '|' + dim('⋅'.repeat(empty))
}

// Calculate current month progress
const currentDay = now.getDate()
const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate()

// Calculate next reset date
const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2
const nextYear = now.getMonth() === 11 ? year + 1 : year
const nextDate = new Date(nextYear, nextMonth - 1, 1)
const nextMonthName = nextDate.toLocaleString('en-US', { month: 'long' })

// Box drawing functions
function drawBoxTop(width: number): string {
  return dim('┌─' + '─'.repeat(width) + '─┐')
}

function drawBoxSeparator(width: number): string {
  return dim('├─' + '─'.repeat(width) + '─┤')
}

function drawBoxBottom(width: number): string {
  return dim('└─' + '─'.repeat(width) + '─┘')
}

function stringWidth(str: string): number {
  return Bun.stringWidth(str)
}

function printBoxLine(text: string, width: number): string {
  const padding = Math.floor((width - stringWidth(text)) / 2)
  const leftPad = padding
  const rightPad = width - stringWidth(text) - leftPad
  return (
    dim('│ ') + ' '.repeat(leftPad) + text + ' '.repeat(rightPad) + dim(' │')
  )
}

function printBoxLeft(text: string, width: number): string {
  const contentWidth = width
  const textVisualWidth = stringWidth(text)
  const rightPad = contentWidth - textVisualWidth
  return dim('│ ') + text + ' '.repeat(Math.max(0, rightPad)) + dim(' │')
}

// Build model breakdown lines
const hasUsage = Array.from(modelCounts.values()).some((count) => count > 0)
let modelLines = ''

if (!hasUsage) {
  modelLines = printBoxLeft('No premium requests used yet.', BOX_INNER_WIDTH)
} else {
  const lines: string[] = []
  const modelsSorted = Array.from(modelCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  ) // Sort by usage desc

  for (const [model, modelCount] of modelsSorted) {
    if (modelCount === 0) continue

    const modelPct = ((modelCount / LIMIT) * 100).toFixed(1)

    // Truncate model name if too long
    let modelDisplay = model
    if (model.length > MODEL_NAME_WIDTH) {
      modelDisplay = model.substring(0, MODEL_NAME_WIDTH - 1) + '…'
    }

    const smallBar = drawBar(modelCount, LIMIT, SMALL_BAR_WIDTH)
    const modelLine = `${modelDisplay.padEnd(MODEL_NAME_WIDTH)}${String(modelCount).padStart(4)}/${LIMIT} ${smallBar}${String(modelPct).padStart(MODEL_USAGE_PCT_WIDTH)}%`
    lines.push(printBoxLeft(modelLine, BOX_INNER_WIDTH))
  }
  modelLines = lines.join('\n')
}

// Generate complete output as a single template string
const output = `${drawBoxTop(BOX_INNER_WIDTH)}
${printBoxLine('', BOX_INNER_WIDTH)}
${printBoxLine('GitHub Copilot Pro - Premium Requests Usage', BOX_INNER_WIDTH)}
${printBoxLine(`${monthName} ${year} • ${username}`, BOX_INNER_WIDTH)}
${printBoxLine('', BOX_INNER_WIDTH)}
${drawBoxSeparator(BOX_INNER_WIDTH)}
${printBoxLeft(`Overall:  ${styleText('bold', totalUsage.toString())}${dim('/' + LIMIT + ' (')}${styleText([color, 'bold'], percentage.toFixed(1) + '%')}${dim(')')}`, BOX_INNER_WIDTH)}
${printBoxLeft(`Usage:    ${drawBar(totalUsage, LIMIT, LARGE_BAR_WIDTH)}`, BOX_INNER_WIDTH)}
${printBoxLeft(`Month:    ${drawMonthProgressBar(currentDay, daysInMonth, LARGE_BAR_WIDTH)}`, BOX_INNER_WIDTH)}
${printBoxLine('', BOX_INNER_WIDTH)}
${printBoxLeft(styleText('dim', `Resets:   ${nextMonthName} 1, ${nextYear} at 00:00 UTC`), BOX_INNER_WIDTH)}
${drawBoxSeparator(BOX_INNER_WIDTH)}
${printBoxLeft(dim('Per-model usage:'), BOX_INNER_WIDTH)}
${printBoxLine('', BOX_INNER_WIDTH)}
${modelLines}
${printBoxLine('', BOX_INNER_WIDTH)}
${drawBoxBottom(BOX_INNER_WIDTH)}
`

console.log(output)
