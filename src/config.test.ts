import { describe, expect, test } from 'bun:test'
import { ConfigReadError, resolveLimit, resolvePlan } from './config.ts'

describe('resolvePlan', () => {
  test('CLI arg takes highest priority', async () => {
    const shellExec = async () => 'max'
    const env = { GH_COPILOT_PLAN: 'free' }
    const result = await resolvePlan('pro+', env, shellExec)
    expect(result).toBe('pro+')
  })

  test('env var used when no CLI arg', async () => {
    const shellExec = async () => { throw new Error('should not call') }
    const env = { GH_COPILOT_PLAN: 'student' }
    const result = await resolvePlan(undefined, env, shellExec)
    expect(result).toBe('student')
  })

  test('env var normalised to lowercase', async () => {
    const shellExec = async () => { throw new Error('should not call') }
    const env = { GH_COPILOT_PLAN: 'MAX' }
    const result = await resolvePlan(undefined, env, shellExec)
    expect(result).toBe('max')
  })

  test('env var ignored if not a valid plan', async () => {
    const shellExec = async () => 'pro+'
    const env = { GH_COPILOT_PLAN: 'invalid' }
    const result = await resolvePlan(undefined, env, shellExec)
    expect(result).toBe('pro+')
  })

  test('gh config used when no CLI arg and no env var', async () => {
    const shellExec = async () => 'pro+\n'
    const result = await resolvePlan(undefined, {}, shellExec)
    expect(result).toBe('pro+')
  })

  test('gh config ignored if not a valid plan', async () => {
    const shellExec = async () => 'unknown_plan\n'
    const result = await resolvePlan(undefined, {}, shellExec)
    expect(result).toBe('pro')
  })

  test('falls back to "pro" when nothing is configured', async () => {
    const shellExec = async () => { throw new Error('config not set') }
    const result = await resolvePlan(undefined, {}, shellExec)
    expect(result).toBe('pro')
  })
})

describe('resolveLimit', () => {
  test('CLI arg takes highest priority', async () => {
    const shellExec = async () => '999'
    const env = { GH_COPILOT_LIMIT: '100' }
    const result = await resolveLimit(500, 'pro', env, shellExec)
    expect(result).toBe(500)
  })

  test('env var used when no CLI arg', async () => {
    const shellExec = async () => { throw new Error('should not call') }
    const env = { GH_COPILOT_LIMIT: '750' }
    const result = await resolveLimit(undefined, 'pro', env, shellExec)
    expect(result).toBe(750)
  })

  test('env var ignored if non-numeric', async () => {
    const shellExec = async () => { throw new Error('config not set') }
    const env = { GH_COPILOT_LIMIT: 'abc' }
    const result = await resolveLimit(undefined, 'pro', env, shellExec)
    expect(result).toBe(1500) // pro default
  })

  test('env var ignored if zero', async () => {
    const shellExec = async () => { throw new Error('config not set') }
    const env = { GH_COPILOT_LIMIT: '0' }
    const result = await resolveLimit(undefined, 'pro', env, shellExec)
    expect(result).toBe(1500)
  })

  test('gh config used when no CLI arg and no env var', async () => {
    const shellExec = async () => '1200\n'
    const result = await resolveLimit(undefined, 'pro', {}, shellExec)
    expect(result).toBe(1200)
  })

  test('gh config ignored if non-numeric', async () => {
    const shellExec = async () => 'bad\n'
    const result = await resolveLimit(undefined, 'pro', {}, shellExec)
    expect(result).toBe(1500)
  })

  test('uses no fixed allowance for free and student plans', async () => {
    const shellExec = async () => { throw new Error('config not set') }

    expect(await resolveLimit(undefined, 'free', {}, shellExec)).toBeNull()
    expect(await resolveLimit(undefined, 'student', {}, shellExec)).toBeNull()
  })

  test('uses current individual plan allowances', async () => {
    const shellExec = async () => { throw new Error('config not set') }

    expect(await resolveLimit(undefined, 'pro', {}, shellExec)).toBe(1500)
    expect(await resolveLimit(undefined, 'pro+', {}, shellExec)).toBe(7000)
    expect(await resolveLimit(undefined, 'max', {}, shellExec)).toBe(20000)
  })

  test('uses legacy request allowances for annual plans', async () => {
    const shellExec = async () => { throw new Error('config not set') }

    expect(
      await resolveLimit(
        undefined,
        'pro',
        {},
        shellExec,
        'premium-requests',
      ),
    ).toBe(300)
    expect(
      await resolveLimit(
        undefined,
        'pro+',
        {},
        shellExec,
        'premium-requests',
      ),
    ).toBe(1500)
  })

  test('env var ignored if negative', async () => {
    const shellExec = async () => { throw new Error('config not set') }
    const env = { GH_COPILOT_LIMIT: '-5' }
    const result = await resolveLimit(undefined, 'pro', env, shellExec)
    expect(result).toBe(1500)
  })
})
