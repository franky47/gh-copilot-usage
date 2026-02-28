import { describe, expect, test } from 'bun:test'
import { FetchError, ParseError, fetchUsage, fetchUsername } from './usage.ts'

const FIXED_DATE = new Date('2025-06-15T12:00:00Z')

describe('fetchUsername', () => {
  test('returns login on success', async () => {
    const fetcher = async () => ({ login: 'octocat', id: 1 })
    const result = await fetchUsername(fetcher)
    expect(result).toBe('octocat')
  })

  test('returns FetchError when fetcher throws', async () => {
    const fetcher = async () => { throw new Error('network error') }
    const result = await fetchUsername(fetcher)
    expect(result).toBeInstanceOf(FetchError)
  })

  test('returns ParseError when response lacks login field', async () => {
    const fetcher = async () => ({ id: 1 })
    const result = await fetchUsername(fetcher)
    expect(result).toBeInstanceOf(ParseError)
  })
})

describe('fetchUsage', () => {
  test('returns UsageData with aggregated model counts', async () => {
    const fetcher = async () => ({
      usageItems: [
        { grossQuantity: 10, model: 'gpt-4o' },
        { grossQuantity: 5, model: 'gpt-4o' },
        { grossQuantity: 3, model: 'claude-3.5-sonnet' },
      ],
    })
    const result = await fetchUsage('octocat', FIXED_DATE, fetcher)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return

    expect(result.totalUsage).toBe(18)
    expect(result.modelCounts.get('gpt-4o')).toBe(15)
    expect(result.modelCounts.get('claude-3.5-sonnet')).toBe(3)
  })

  test('uses "Unknown" for items without a model field', async () => {
    const fetcher = async () => ({
      usageItems: [{ grossQuantity: 7 }],
    })
    const result = await fetchUsage('octocat', FIXED_DATE, fetcher)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return

    expect(result.modelCounts.get('Unknown')).toBe(7)
  })

  test('handles missing usageItems gracefully', async () => {
    const fetcher = async () => ({})
    const result = await fetchUsage('octocat', FIXED_DATE, fetcher)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return

    expect(result.totalUsage).toBe(0)
    expect(result.modelCounts.size).toBe(0)
  })

  test('handles empty usageItems array', async () => {
    const fetcher = async () => ({ usageItems: [] })
    const result = await fetchUsage('octocat', FIXED_DATE, fetcher)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return

    expect(result.totalUsage).toBe(0)
    expect(result.modelCounts.size).toBe(0)
  })

  test('returns FetchError when fetcher throws', async () => {
    const fetcher = async () => { throw new Error('network error') }
    const result = await fetchUsage('octocat', FIXED_DATE, fetcher)
    expect(result).toBeInstanceOf(FetchError)
  })

  test('returns ParseError for malformed response', async () => {
    const fetcher = async () => ({ usageItems: [{ grossQuantity: 'not-a-number' }] })
    const result = await fetchUsage('octocat', FIXED_DATE, fetcher)
    expect(result).toBeInstanceOf(ParseError)
  })

  test('populates date fields correctly', async () => {
    const fetcher = async () => ({ usageItems: [] })
    const result = await fetchUsage('octocat', FIXED_DATE, fetcher)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return

    expect(result.year).toBe(2025)
    expect(result.month).toBe('06')
    expect(result.monthName).toBe('June')
    expect(result.currentDay).toBe(15)
    expect(result.daysInMonth).toBe(30)
    expect(result.username).toBe('octocat')
  })

  test('next reset date is first of next month', async () => {
    const fetcher = async () => ({ usageItems: [] })
    const result = await fetchUsage('octocat', FIXED_DATE, fetcher)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return

    expect(result.nextResetDate.getFullYear()).toBe(2025)
    expect(result.nextResetDate.getMonth()).toBe(6) // July (0-indexed)
    expect(result.nextResetDate.getDate()).toBe(1)
  })

  test('next reset date wraps year correctly in December', async () => {
    const fetcher = async () => ({ usageItems: [] })
    const decDate = new Date('2025-12-10T12:00:00Z')
    const result = await fetchUsage('octocat', decDate, fetcher)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return

    expect(result.nextResetDate.getFullYear()).toBe(2026)
    expect(result.nextResetDate.getMonth()).toBe(0) // January
    expect(result.nextResetDate.getDate()).toBe(1)
  })

  test('rounds totalUsage to 2 decimal places', async () => {
    const fetcher = async () => ({
      usageItems: [
        { grossQuantity: 1.333, model: 'a' },
        { grossQuantity: 1.333, model: 'a' },
        { grossQuantity: 1.334, model: 'a' },
      ],
    })
    const result = await fetchUsage('octocat', FIXED_DATE, fetcher)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return

    expect(result.totalUsage).toBe(4)
  })
})
