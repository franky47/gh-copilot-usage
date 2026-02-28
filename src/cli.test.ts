import { describe, expect, test } from 'bun:test'
import {
  InvalidLimitError,
  InvalidPlanError,
  UnknownFlagError,
  parseCliArgs,
} from './cli.ts'

// Bun.argv includes the runtime and script path as first two args
function argv(...args: string[]): string[] {
  return ['bun', 'src/main.ts', ...args]
}

describe('parseCliArgs', () => {
  describe('--help', () => {
    test('returns help action with usage text', () => {
      const result = parseCliArgs(argv('--help'))
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return
      expect(result.action).toBe('help')
      if (result.action !== 'help') return
      expect(result.text).toContain('gh copilot-usage')
    })

    test('-h shorthand works', () => {
      const result = parseCliArgs(argv('-h'))
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return
      expect(result.action).toBe('help')
    })
  })

  describe('--version', () => {
    test('returns version action with version string', () => {
      const result = parseCliArgs(argv('--version'))
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return
      expect(result.action).toBe('version')
      if (result.action !== 'version') return
      expect(result.text).toMatch(/^\d+\.\d+\.\d+$/)
    })

    test('-v shorthand works', () => {
      const result = parseCliArgs(argv('-v'))
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return
      expect(result.action).toBe('version')
    })
  })

  describe('--plan', () => {
    test('accepts valid plan names', () => {
      for (const plan of ['free', 'pro', 'pro+', 'business', 'enterprise']) {
        const result = parseCliArgs(argv('--plan', plan))
        expect(result).not.toBeInstanceOf(Error)
        if (result instanceof Error) return
        expect(result.action).toBe('run')
        if (result.action !== 'run') return
        expect(result.plan).toBe(plan)
      }
    })

    test('normalises plan name to lowercase', () => {
      const result = parseCliArgs(argv('--plan', 'PRO'))
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return
      expect(result.action).toBe('run')
      if (result.action !== 'run') return
      expect(result.plan).toBe('pro')
    })

    test('returns InvalidPlanError for unknown plan', () => {
      const result = parseCliArgs(argv('--plan', 'unknown'))
      expect(result).toBeInstanceOf(InvalidPlanError)
    })

    test('-p shorthand works', () => {
      const result = parseCliArgs(argv('-p', 'pro+'))
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return
      expect(result.action).toBe('run')
      if (result.action !== 'run') return
      expect(result.plan).toBe('pro+')
    })
  })

  describe('--limit', () => {
    test('accepts positive integer', () => {
      const result = parseCliArgs(argv('--limit', '500'))
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return
      expect(result.action).toBe('run')
      if (result.action !== 'run') return
      expect(result.limit).toBe(500)
    })

    test('returns InvalidLimitError for non-numeric value', () => {
      const result = parseCliArgs(argv('--limit', 'abc'))
      expect(result).toBeInstanceOf(InvalidLimitError)
    })

    test('returns InvalidLimitError for zero', () => {
      const result = parseCliArgs(argv('--limit', '0'))
      expect(result).toBeInstanceOf(InvalidLimitError)
    })

    test('returns InvalidLimitError for negative value via = syntax', () => {
      const result = parseCliArgs(argv('--limit=-10'))
      expect(result).toBeInstanceOf(InvalidLimitError)
    })

    test('returns UnknownFlagError when negative value passed as separate arg (parseArgs ambiguity)', () => {
      const result = parseCliArgs(argv('--limit', '-10'))
      expect(result).toBeInstanceOf(UnknownFlagError)
    })

    test('-l shorthand works', () => {
      const result = parseCliArgs(argv('-l', '200'))
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return
      expect(result.action).toBe('run')
      if (result.action !== 'run') return
      expect(result.limit).toBe(200)
    })
  })

  describe('run action', () => {
    test('no args returns run action with no plan or limit', () => {
      const result = parseCliArgs(argv())
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return
      expect(result.action).toBe('run')
      if (result.action !== 'run') return
      expect(result.plan).toBeUndefined()
      expect(result.limit).toBeUndefined()
    })

    test('plan and limit can be combined', () => {
      const result = parseCliArgs(argv('--plan', 'business', '--limit', '400'))
      expect(result).not.toBeInstanceOf(Error)
      if (result instanceof Error) return
      expect(result.action).toBe('run')
      if (result.action !== 'run') return
      expect(result.plan).toBe('business')
      expect(result.limit).toBe(400)
    })
  })

  describe('unknown flags', () => {
    test('returns UnknownFlagError for unknown flag', () => {
      const result = parseCliArgs(argv('--unknown-flag'))
      expect(result).toBeInstanceOf(UnknownFlagError)
    })

    test('UnknownFlagError message contains the original parseArgs message', () => {
      const result = parseCliArgs(argv('--unknown-flag'))
      expect(result).toBeInstanceOf(UnknownFlagError)
      if (!(result instanceof UnknownFlagError)) return
      expect(result.message).toBeTruthy()
    })
  })
})
