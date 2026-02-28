import * as errore from 'errore'
import { parseArgs } from 'node:util'
import pkgJson from '../package.json'
import { PLANS } from './config.ts'

const VERSION = pkgJson.version

export class InvalidPlanError extends errore.createTaggedError({
  name: 'InvalidPlanError',
  message: 'Invalid plan "$plan". Must be one of: $validPlans',
}) {}

export class InvalidLimitError extends errore.createTaggedError({
  name: 'InvalidLimitError',
  message: 'Invalid limit "$value". Must be a positive integer.',
}) {}

export class UnknownFlagError extends errore.createTaggedError({
  name: 'UnknownFlagError',
  message: '$reason',
}) {}

export type CliResult =
  | { action: 'help'; text: string }
  | { action: 'version'; text: string }
  | { action: 'run'; plan?: string; limit?: number }

export function parseCliArgs(
  argv: string[],
): CliResult | InvalidPlanError | InvalidLimitError | UnknownFlagError {
  let rawPlan: string | undefined
  let rawLimit: string | undefined
  let help: boolean | undefined
  let version: boolean | undefined

  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        plan: { type: 'string', short: 'p' },
        limit: { type: 'string', short: 'l' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
      strict: true,
      allowPositionals: true,
    })
    rawPlan = parsed.values.plan
    rawLimit = parsed.values.limit
    help = parsed.values.help
    version = parsed.values.version
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return new UnknownFlagError({ reason })
  }

  if (help) {
    return {
      action: 'help',
      text: `
GitHub Copilot Premium Requests Usage Tracker v${VERSION}

Usage:
  gh copilot-usage [options]

Options:
  --plan <name>       Set your Copilot plan (${Object.keys(PLANS).join(', ')})
  --limit <number>    Set custom monthly premium request limits
  --help, -h          Show this help message
  --version, -v       Show version information

Configuration:
  The plan can be configured in multiple ways (in order of priority):
    1. Command line flag: --plan pro
    2. Environment variable: GH_COPILOT_PLAN=pro
    3. gh config: gh config set copilot-usage.plan pro
    4. Default: pro

  The limit can be configured in multiple ways (in order of priority):
    1. Command line flag: --limit 300
    2. Environment variable: GH_COPILOT_LIMIT=300
    3. gh config: gh config set copilot-usage.limit 300
    4. Plan's default limit (based on selected plan)

Examples:
  gh copilot-usage
  gh copilot-usage --plan pro+
  gh copilot-usage --limit 500
  GH_COPILOT_LIMIT=500 gh copilot-usage
`,
    }
  }

  if (version) {
    return { action: 'version', text: VERSION }
  }

  let plan: string | undefined
  if (rawPlan !== undefined) {
    const planKey = rawPlan.toLowerCase()
    if (!PLANS[planKey]) {
      return new InvalidPlanError({
        plan: rawPlan,
        validPlans: Object.keys(PLANS).join(', '),
      })
    }
    plan = planKey
  }

  let limit: number | undefined
  if (rawLimit !== undefined) {
    const value = parseInt(rawLimit, 10)
    if (isNaN(value) || value <= 0) {
      return new InvalidLimitError({ value: rawLimit })
    }
    limit = value
  }

  return { action: 'run', plan, limit }
}
