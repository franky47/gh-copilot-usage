import * as errore from 'errore'

export const PLANS: Record<string, number> = {
  free: 50,
  pro: 300,
  'pro+': 1500,
  business: 300,
  enterprise: 1000,
}

export const DEFAULT_PLAN = 'pro'

export class ConfigReadError extends errore.createTaggedError({
  name: 'ConfigReadError',
  message: 'Failed to read gh config key "$key"',
}) {}

export type ShellExec = (cmd: string) => Promise<string>

export async function resolvePlan(
  cliPlan: string | undefined,
  env: NodeJS.ProcessEnv,
  shellExec: ShellExec,
): Promise<string> {
  if (cliPlan !== undefined) {
    return cliPlan
  }

  const envPlan = env.GH_COPILOT_PLAN
  if (envPlan !== undefined && PLANS[envPlan.toLowerCase()]) {
    return envPlan.toLowerCase()
  }

  const configPlan = await readGhConfig('copilot-usage.plan', shellExec)
  if (configPlan instanceof ConfigReadError) {
    // Config key not set — fall through to default (not an error)
    return DEFAULT_PLAN
  }
  const planKey = configPlan.trim().toLowerCase()
  if (PLANS[planKey]) {
    return planKey
  }

  return DEFAULT_PLAN
}

export async function resolveLimit(
  cliLimit: number | undefined,
  plan: string,
  env: NodeJS.ProcessEnv,
  shellExec: ShellExec,
): Promise<number> {
  if (cliLimit !== undefined) {
    return cliLimit
  }

  const envLimit = env.GH_COPILOT_LIMIT
  if (envLimit !== undefined) {
    const parsed = parseInt(envLimit, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  const configLimit = await readGhConfig('copilot-usage.limit', shellExec)
  if (configLimit instanceof ConfigReadError) {
    // Config key not set — fall through to plan default (not an error)
    return PLANS[plan] ?? 300
  }
  const parsed = parseInt(configLimit.trim(), 10)
  if (!isNaN(parsed) && parsed > 0) {
    return parsed
  }

  return PLANS[plan] ?? 300
}

async function readGhConfig(
  key: string,
  shellExec: ShellExec,
): Promise<string | ConfigReadError> {
  return shellExec(`gh config get ${key}`).catch(
    (e) => new ConfigReadError({ key, cause: e }),
  )
}
