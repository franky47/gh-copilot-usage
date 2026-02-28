import * as errore from 'errore'
import { z } from 'zod'

export type Fetcher = (url: string) => Promise<unknown>

export type UsageData = {
  username: string
  year: number
  month: string
  monthName: string
  currentDay: number
  daysInMonth: number
  nextResetDate: Date
  totalUsage: number
  modelCounts: Map<string, number>
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
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  const rawOrError = await fetcher(
    `/users/${username}/settings/billing/premium_request/usage?year=${year}&month=${month}`,
  ).catch((e: unknown) => {
    const reason = e instanceof Error ? e.message : String(e)
    return new FetchError({ reason, cause: e instanceof Error ? e : undefined })
  })

  if (rawOrError instanceof FetchError) return rawOrError
  const raw: unknown = rawOrError

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

  const monthName = now.toLocaleString('en-US', { month: 'long' })
  const currentDay = now.getDate()
  const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate()

  const nextMonthIndex = now.getMonth() === 11 ? 0 : now.getMonth() + 1
  const nextYear = now.getMonth() === 11 ? year + 1 : year
  const nextResetDate = new Date(Date.UTC(nextYear, nextMonthIndex, 1))

  return {
    username,
    year,
    month,
    monthName,
    currentDay,
    daysInMonth,
    nextResetDate,
    totalUsage,
    modelCounts,
  }
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
