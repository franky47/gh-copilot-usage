#!/usr/bin/env bun

import { $ } from 'bun'
import { parseCliArgs } from './cli.ts'
import { resolvePlan, resolveLimit } from './config.ts'
import { fetchUsage, fetchUsername } from './usage.ts'
import { renderDisplay } from './display.ts'

async function shellExec(cmd: string): Promise<string> {
  const [bin, ...args] = cmd.split(' ')
  return $`${[bin, ...args]}`.text()
}

async function fetcher(path: string): Promise<unknown> {
  return $`gh api ${path}`.json()
}

async function main() {
  const cliResult = parseCliArgs(Bun.argv)

  if (cliResult instanceof Error) {
    console.error(`Error: ${cliResult.message}`)
    process.exit(1)
  }

  if (cliResult.action === 'help') {
    console.log(cliResult.text)
    process.exit(0)
  }

  if (cliResult.action === 'version') {
    console.log(cliResult.text)
    process.exit(0)
  }

  const plan = await resolvePlan(cliResult.plan, process.env, shellExec)
  const limit = await resolveLimit(cliResult.limit, plan, process.env, shellExec)

  const username = await fetchUsername(fetcher)
  if (username instanceof Error) {
    console.error(`Error: ${username.message}`)
    process.exit(1)
  }

  const usage = await fetchUsage(username, new Date(), fetcher)
  if (usage instanceof Error) {
    console.error(`Error: ${usage.message}`)
    process.exit(1)
  }

  const width = Math.min(80, process.stdout.columns ?? 80)
  const output = renderDisplay(usage, plan, limit, {
    width,
    stringWidth: Bun.stringWidth,
  })
  console.log(output)
}

main()
