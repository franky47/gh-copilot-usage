import { describe, expect, test } from 'bun:test'
import { renderDisplay } from './display.ts'
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
