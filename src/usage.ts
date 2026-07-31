import * as errore from 'errore'
import { z } from 'zod'

export type Fetcher = (url: string) => Promise<unknown>
export type BillingUnit = 'ai-credits' | 'premium-requests'

export type UsageData = {
  username: string
  year: number
  month: string
  monthName: string
  currentDay: number
  daysInMonth: number
  nextResetDate: Date
  now: Date
  totalUsage: number
  modelCounts: Map<string, number>
  billingUnit: BillingUnit
}

export class FetchError extends errore.createTaggedError({
  name: 'FetchError',
  message: 'Failed to fetch data: $reason',
}) {}

export class ParseError extends errore.createTaggedError({
  name: 'ParseError',
  message: 'Failed to parse API response: $reason',
}) {}

const usageItemSchema = z.object({
  grossQuantity: z.number(),
  model: z.string().optional(),
})

const usageResponseSchema = z.object({
  usageItems: z.array(usageItemSchema).optional(),
})

export async function fetchUsage(
  username: string,
  now: Date,
  fetcher: Fetcher,
): Promise<UsageData | FetchError | ParseError> {
  const year = now.getUTCFullYear()
  const monthIndex = now.getUTCMonth()
  const month = String(monthIndex + 1).padStart(2, '0')
  const pathPrefix = `/users/${username}/settings/billing`
  const query = `year=${year}&month=${month}`

  const aiCredits = await fetchResponse(
    `${pathPrefix}/ai_credit/usage?${query}`,
    fetcher,
  )
  let raw: unknown
  let billingUnit: BillingUnit

  if (aiCredits instanceof FetchError) {
    if (!/\bHTTP 404\b/.test(aiCredits.message)) return aiCredits

    const premiumRequests = await fetchResponse(
      `${pathPrefix}/premium_request/usage?${query}`,
      fetcher,
    )
    if (premiumRequests instanceof FetchError) {
      return new FetchError({
        reason: `${aiCredits.message}; legacy fallback: ${premiumRequests.message}`,
        cause: premiumRequests,
      })
    }
    raw = premiumRequests
    billingUnit = 'premium-requests'
  } else {
    raw = aiCredits
    billingUnit = 'ai-credits'

    const parsedAiCredits = usageResponseSchema.safeParse(aiCredits)
    if (
      parsedAiCredits.success &&
      (parsedAiCredits.data.usageItems?.length ?? 0) === 0
    ) {
      const premiumRequests = await fetchResponse(
        `${pathPrefix}/premium_request/usage?${query}`,
        fetcher,
      )
      if (!(premiumRequests instanceof FetchError)) {
        const parsedPremiumRequests =
          usageResponseSchema.safeParse(premiumRequests)
        if (
          parsedPremiumRequests.success &&
          (parsedPremiumRequests.data.usageItems?.length ?? 0) > 0
        ) {
          raw = premiumRequests
          billingUnit = 'premium-requests'
        }
      }
    }
  }

  const parsed = usageResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return new ParseError({ reason: parsed.error.message })
  }

  const items = parsed.data.usageItems ?? []
  const totalUsage =
    Math.round(
      items.reduce((sum: number, item) => sum + item.grossQuantity, 0) * 100,
    ) / 100

  const modelCounts = new Map<string, number>()
  for (const item of items) {
    const model = item.model ?? 'Unknown'
    modelCounts.set(model, (modelCounts.get(model) ?? 0) + item.grossQuantity)
  }

  const monthName = now.toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  })
  const currentDay = now.getUTCDate()
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1
  const nextYear = monthIndex === 11 ? year + 1 : year
  const nextResetDate = new Date(Date.UTC(nextYear, nextMonthIndex, 1))

  return {
    username,
    year,
    month,
    monthName,
    currentDay,
    daysInMonth,
    nextResetDate,
    now,
    totalUsage,
    modelCounts,
    billingUnit,
  }
}

async function fetchResponse(
  path: string,
  fetcher: Fetcher,
): Promise<unknown | FetchError> {
  return fetcher(path).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    return new FetchError({
      reason,
      cause: error instanceof Error ? error : undefined,
    })
  })
}

export async function fetchUsername(
  fetcher: Fetcher,
): Promise<string | FetchError | ParseError> {
  const rawOrError = await fetcher('/user').catch((e: unknown) => {
    const reason = e instanceof Error ? e.message : String(e)
    return new FetchError({ reason, cause: e instanceof Error ? e : undefined })
  })

  if (rawOrError instanceof FetchError) return rawOrError
  const raw: unknown = rawOrError

  const parsed = z.object({ login: z.string() }).safeParse(raw)
  if (!parsed.success) {
    return new ParseError({
      reason: 'Could not parse login from /user response',
    })
  }

  return parsed.data.login
}
