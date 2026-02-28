import { describe, expect, test } from 'bun:test'
import { getModelColor, getOverallColor, renderDisplay } from './display.ts'
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
    nextResetDate: new Date(2025, 6, 1), // July 1
    totalUsage: 0,
    modelCounts: new Map(),
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

  test('shows "No premium requests used yet." when usage is zero', () => {
    const result = renderDisplay(
      makeUsageData({ totalUsage: 0, modelCounts: new Map() }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toContain('No premium requests used yet.')
  })

  test('shows per-model breakdown when usage exists', () => {
    const modelCounts = new Map([
      ['gpt-4o', 100],
      ['claude-3.5-sonnet', 50],
    ])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 150, modelCounts }),
      'pro',
      300,
      RENDER_OPTIONS,
    )
    expect(result).toContain('gpt-4o')
    expect(result).toContain('claude-3.5-sonnet')
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

  test('high usage (red zone), business plan', () => {
    const modelCounts = new Map([
      ['gpt-4o', 500],
      ['claude-3.5-sonnet', 280],
    ])
    const result = renderDisplay(
      makeUsageData({ totalUsage: 780, modelCounts }),
      'business',
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
        nextResetDate: new Date(2026, 0, 1),
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
})
