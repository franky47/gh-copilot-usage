import { describe, expect, test } from 'bun:test'
import {
  formatTimeUntilReset,
  getModelColor,
  getOverallColor,
  renderDisplay,
} from './display.ts'
import type { UsageData } from './usage.ts'

const RENDER_OPTIONS = { width: 80 }

function makeUsageData(overrides: Partial<UsageData> = {}): UsageData {
  return {
    username: 'octocat',
    year: 2025,
    month: '06',
    monthName: 'June',
    currentDay: 15,
    daysInMonth: 30,
    nextResetDate: new Date(Date.UTC(2025, 6, 1)), // July 1 UTC
    now: new Date(Date.UTC(2025, 5, 15)), // June 15 UTC — >7 days before reset
    totalUsage: 0,
    modelCounts: new Map(),
    billingUnit: 'ai-credits',
    ...overrides,
  }
}

describe('renderDisplay', () => {
  test('returns a non-empty string', () => {
    const result = renderDisplay(makeUsageData(), 'pro', 300, RENDER_OPTIONS)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  test('contains username', () => {
    const result = renderDisplay(makeUsageData(), 'pro', 300, RENDER_OPTIONS)
    expect(result).toContain('octocat')
  })

  test('contains month name and year', () => {
    const result = renderDisplay(makeUsageData(), 'pro', 300, RENDER_OPTIONS)
    expect(result).toContain('June')
    expect(result).toContain('2025')
  })

  test('contains plan name', () => {
    const result = renderDisplay(makeUsageData(), 'pro+', 1500, RENDER_OPTIONS)
    expect(result).toContain('Pro+')
  })

  test('uses AI credit terms', () => {
    const result = renderDisplay(
      makeUsageData({ totalUsage: 0, modelCounts: new Map() }),
      'pro',
      1500,
      RENDER_OPTIONS,
    )
    expect(result).toContain('AI Credit Usage')
    expect(result).toContain('No AI credits used yet.')
    expect(result).not.toContain('premium request')
  })

  test('uses premium request terms for annual plans', () => {
    const result = renderDisplay(
      makeUsageData({ billingUnit: 'premium-requests' }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toContain('Premium Request Usage')
    expect(result).toContain('No premium requests used yet.')
  })

  test('shows usage without a percentage when the plan has no fixed allowance', () => {
    const result = renderDisplay(
      makeUsageData({
        totalUsage: 12.5,
        modelCounts: new Map([['auto', 12.5]]),
      }),
      'free',
      null,
      RENDER_OPTIONS,
    )
    expect(result).toContain('Overall:')
    expect(result).toContain('12.5')
    expect(result).not.toContain('Infinity')
    expect(result).not.toContain('NaN')
  })

  test('shows per-model breakdown with fractional credits', () => {
    const modelCounts = new Map([
      ['gpt-4o', 100.25],
      ['claude-3.5-sonnet', 50.5],
    ])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 150.75, modelCounts }),
      'pro',
      1500,
      RENDER_OPTIONS,
    )
    expect(result).toContain('gpt-4o')
    expect(result).toContain('100.25')
    expect(result).toContain('claude-3.5-sonnet')
    expect(result).toContain('50.5')
  })

  test('sorts models by usage descending', () => {
    const modelCounts = new Map([
      ['model-a', 10],
      ['model-b', 100],
    ])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 110, modelCounts }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    const indexA = result.indexOf('model-a')
    const indexB = result.indexOf('model-b')
    expect(indexB).toBeLessThan(indexA)
  })

  test('truncates model names longer than 22 characters', () => {
    const longName = 'a-very-long-model-name-that-exceeds-limit'
    const modelCounts = new Map([[longName, 50]])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 50, modelCounts }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).not.toContain(longName)
    expect(result).toContain('…')
  })

  test('shows next reset month name', () => {
    const result = renderDisplay(makeUsageData(), 'pro', 300, RENDER_OPTIONS)
    expect(result).toContain('July')
  })

  test('contains overall usage count', () => {
    const result = renderDisplay(
      makeUsageData({ totalUsage: 42 }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toContain('42')
  })

  test('contains the limit', () => {
    const result = renderDisplay(makeUsageData(), 'pro', 300, RENDER_OPTIONS)
    expect(result).toContain('300')
  })

  test('skips models with zero usage', () => {
    const modelCounts = new Map([
      ['active-model', 50],
      ['zero-model', 0],
    ])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 50, modelCounts }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toContain('active-model')
    expect(result).not.toContain('zero-model')
  })

  test('each output line fits within the given width', () => {
    const modelCounts = new Map([['gpt-4o', 150]])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 150, modelCounts }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    for (const line of result.split('\n')) {
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(RENDER_OPTIONS.width)
    }
  })

  test('uses UTC for the reset label', () => {
    const originalTimeZone = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      const result = renderDisplay(
        makeUsageData({
          nextResetDate: new Date('2026-01-01T00:00:00Z'),
        }),
        'pro',
        1500,
        RENDER_OPTIONS,
      )
      expect(result).toContain('January 1, 2026 at 00:00 UTC')
    } finally {
      if (originalTimeZone === undefined) delete process.env.TZ
      else process.env.TZ = originalTimeZone
    }
  })

  test('each output line fits when a credit amount is large', () => {
    const modelCounts = new Map([['gpt-4o', 123456.78]])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 123456.78, modelCounts }),
      'max',
      20000,
      RENDER_OPTIONS,
    )
    for (const line of result.split('\n')) {
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(RENDER_OPTIONS.width)
    }
  })

  test('uses a narrow model layout when bars do not fit', () => {
    const result = renderDisplay(
      makeUsageData({
        totalUsage: 10,
        modelCounts: new Map([['gpt-4o', 10]]),
      }),
      'pro',
      1500,
      { width: 40 },
    )
    expect(result).toContain('gpt-4o')
    for (const line of result.split('\n')) {
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(40)
    }
  })

  test('fits a long username in a narrow layout', () => {
    const result = renderDisplay(
      makeUsageData({ username: 'a-very-long-github-username-that-does-not-fit' }),
      'pro',
      1500,
      { width: 40 },
    )
    for (const line of result.split('\n')) {
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(40)
    }
  })

  test('uses a safe minimum width', () => {
    const result = renderDisplay(
      makeUsageData({
        totalUsage: 10,
        modelCounts: new Map([['gpt-4o', 10]]),
      }),
      'pro',
      1500,
      { width: 20 },
    )
    for (const line of result.split('\n')) {
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(40)
    }
  })

  test('each output line fits within width when relative time is shown', () => {
    const nextResetDate = new Date(Date.UTC(2025, 6, 1))
    const now = new Date(Date.UTC(2025, 5, 26, 12, 0, 0)) // ~4.5 days before
    const result = renderDisplay(
      makeUsageData({ nextResetDate, now }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    for (const line of result.split('\n')) {
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(RENDER_OPTIONS.width)
    }
  })
})

describe('month-cursor color logic', () => {
  // New logic: green if usageRatio < monthProgress
  //            yellow if usageRatio >= monthProgress and < (1 + monthProgress) / 2
  //            red if usageRatio >= (1 + monthProgress) / 2

  test('usage strictly below month cursor returns green', () => {
    // day 25/30 → cursor 0.833, usage 80% → 0.80 < 0.833 → green
    expect(getOverallColor(80, 25 / 30)).toBe('green')
  })

  test('usage at month cursor returns yellow', () => {
    // day 20/30 → cursor 0.667, redThreshold = (1 + 0.667) / 2 = 0.833
    // usage 66.7% → 0.667 >= 0.667 and < 0.833 → yellow
    expect(getOverallColor(66.7, 20 / 30)).toBe('yellow')
  })

  test('usage between cursor and halfway point returns yellow', () => {
    // day 10/30 → cursor 0.333, redThreshold = (1 + 0.333) / 2 = 0.667
    // usage 50% → 0.50 >= 0.333 and < 0.667 → yellow
    expect(getOverallColor(50, 10 / 30)).toBe('yellow')
  })

  test('usage at the halfway point returns red', () => {
    // day 10/30 → cursor 0.333, redThreshold = 0.667
    // usage 66.7% → 0.667 >= 0.667 → red
    expect(getOverallColor(66.7, 10 / 30)).toBe('red')
  })

  test('usage beyond halfway point returns red', () => {
    // day 20/30 → cursor 0.667, redThreshold = 0.833
    // usage 95% → 0.95 >= 0.833 → red
    expect(getOverallColor(95, 20 / 30)).toBe('red')
  })

  test('usage over 100% returns red', () => {
    // day 10/30 → cursor 0.333, redThreshold = 0.667
    // usage 150% → 1.50 >= 0.667 → red
    expect(getOverallColor(150, 10 / 30)).toBe('red')
  })

  test('day 1 of 30: red threshold is near 50% usage', () => {
    // cursor ≈ 0.033, redThreshold ≈ (1 + 0.033) / 2 ≈ 0.517
    // usage 40% → green (below cursor? no: 0.40 >= 0.033) → yellow
    expect(getOverallColor(40, 1 / 30)).toBe('yellow')
    // usage 52% → 0.52 >= 0.517 → red
    expect(getOverallColor(52, 1 / 30)).toBe('red')
  })

  test('last day of month: red threshold is near 100% usage', () => {
    // cursor = 1.0, redThreshold = (1 + 1) / 2 = 1.0
    // any usage < 100% → green (below cursor)
    expect(getOverallColor(99, 30 / 30)).toBe('green')
    // usage 100% → 1.00 >= 1.00 → red (no yellow band when cursor is at end)
    expect(getOverallColor(100, 30 / 30)).toBe('red')
  })
})

describe('getModelColor', () => {
  test('below yellow threshold returns green', () => {
    expect(getModelColor(74.9)).toBe('green')
  })

  test('at yellow threshold returns yellow', () => {
    expect(getModelColor(75)).toBe('yellow')
  })

  test('at red threshold returns red', () => {
    expect(getModelColor(90)).toBe('red')
  })
})

describe('renderDisplay snapshots', () => {
  test('above threshold but below month cursor (green override)', () => {
    // 80% usage but 83% through month → stays green
    const modelCounts = new Map([['gpt-4o', 240]])
    const result = renderDisplay(
      makeUsageData({
        totalUsage: 240,
        modelCounts,
        currentDay: 25,
        daysInMonth: 30,
      }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toMatchSnapshot()
  })

  test('zero usage, pro plan', () => {
    const result = renderDisplay(makeUsageData(), 'pro', 300, RENDER_OPTIONS)
    expect(result).toMatchSnapshot()
  })

  test('low usage (green zone), pro plan, single model', () => {
    const modelCounts = new Map([['gpt-4o', 60]])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 60, modelCounts }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toMatchSnapshot()
  })

  test('mid usage (yellow zone), pro+ plan, multiple models', () => {
    const modelCounts = new Map([
      ['gpt-4o', 150],
      ['claude-3.5-sonnet', 80],
      ['o3-mini', 10],
    ])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 240, modelCounts }),
      'pro+',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toMatchSnapshot()
  })

  test('high usage (red zone), max plan', () => {
    const modelCounts = new Map([
      ['gpt-4o', 500],
      ['claude-3.5-sonnet', 280],
    ])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 780, modelCounts }),
      'max',
      800,
      RENDER_OPTIONS,
    )
    expect(result).toMatchSnapshot()
  })

  test('usage exceeds limit (over 100%)', () => {
    const modelCounts = new Map([['gpt-4o', 350]])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 350, modelCounts }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toMatchSnapshot()
  })

  test('long model name gets truncated', () => {
    const modelCounts = new Map([
      ['a-very-long-model-name-that-exceeds-limit', 100],
      ['gpt-4o', 50],
    ])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 150, modelCounts }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toMatchSnapshot()
  })

  test('end of month, next reset in following year', () => {
    const result = renderDisplay(
      makeUsageData({
        month: '12',
        monthName: 'December',
        currentDay: 31,
        daysInMonth: 31,
        nextResetDate: new Date(Date.UTC(2026, 0, 1)),
      }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toMatchSnapshot()
  })

  test('layout at 60 columns', () => {
    const modelCounts = new Map([
      ['gpt-4o', 120],
      ['claude-3.5-sonnet', 60],
    ])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 180, modelCounts }),
      'pro',
      300,
      { width: 60 },
    )
    expect(result).toMatchSnapshot()
  })

  test('layout at 100 columns', () => {
    const modelCounts = new Map([
      ['gpt-4o', 120],
      ['claude-3.5-sonnet', 60],
    ])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 180, modelCounts }),
      'pro',
      300,
      { width: 100 },
    )
    expect(result).toMatchSnapshot()
  })

  test('within 7 days of reset shows relative time', () => {
    const nextResetDate = new Date(Date.UTC(2025, 6, 1)) // July 1 UTC midnight
    const now = new Date(Date.UTC(2025, 5, 26, 12, 0, 0)) // ~4.5 days before
    const result = renderDisplay(
      makeUsageData({ nextResetDate, now }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toMatchSnapshot()
  })
})

describe('formatTimeUntilReset', () => {
  const reset = new Date(Date.UTC(2025, 6, 1)) // July 1 00:00 UTC

  test('returns null when more than 7 days away', () => {
    const now = new Date(Date.UTC(2025, 5, 23)) // 8 days before
    expect(formatTimeUntilReset(now, reset)).toBeNull()
  })

  test('returns null exactly at 7-day boundary', () => {
    const now = new Date(reset.getTime() - 7 * 24 * 60 * 60 * 1000)
    expect(formatTimeUntilReset(now, reset)).toBeNull()
  })

  test('returns days when between 1 and 7 days away', () => {
    const now = new Date(reset.getTime() - 5 * 24 * 60 * 60 * 1000)
    expect(formatTimeUntilReset(now, reset)).toBe('in 5 days')
  })

  test('returns singular day when exactly 1 day away', () => {
    const now = new Date(reset.getTime() - 24 * 60 * 60 * 1000)
    expect(formatTimeUntilReset(now, reset)).toBe('in 1 day')
  })

  test('returns hours when exactly 24h minus 1ms away', () => {
    const now = new Date(reset.getTime() - 24 * 60 * 60 * 1000 + 1)
    expect(formatTimeUntilReset(now, reset)).toBe('in 23h')
  })

  test('returns hours when less than 24h away', () => {
    const now = new Date(reset.getTime() - 23 * 60 * 60 * 1000)
    expect(formatTimeUntilReset(now, reset)).toBe('in 23h')
  })

  test('returns hours when exactly 12h away', () => {
    const now = new Date(reset.getTime() - 12 * 60 * 60 * 1000)
    expect(formatTimeUntilReset(now, reset)).toBe('in 12h')
  })

  test('returns hours and minutes when less than 12h away', () => {
    const now = new Date(reset.getTime() - (6 * 60 + 30) * 60 * 1000)
    expect(formatTimeUntilReset(now, reset)).toBe('in 6h 30min')
  })

  test('returns only minutes when less than 1h away', () => {
    const now = new Date(reset.getTime() - 45 * 60 * 1000)
    expect(formatTimeUntilReset(now, reset)).toBe('in 45min')
  })

  test('returns null when reset is in the past', () => {
    const now = new Date(reset.getTime() + 1000)
    expect(formatTimeUntilReset(now, reset)).toBeNull()
  })
})
