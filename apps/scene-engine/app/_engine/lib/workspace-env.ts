import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Shared API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, ...) live in one file
// outside the repo: ~/workspace/.env, or the path in WORKSPACE_ENV_FILE.
// Next loads this app's own .env files first. This fills in only variables
// that are still unset, so real environment variables win, then the app's
// .env files, then the workspace file. A missing file is skipped.

let loaded = false

export function workspaceEnvFile(): string {
  const configured = process.env.WORKSPACE_ENV_FILE?.trim()
  if (configured) return configured.replace(/^~(?=$|[\\/])/, os.homedir())
  return path.join(os.homedir(), 'workspace', '.env')
}

export function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    let value = rawValue.trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
      value = value.slice(1, -1)
      if (quote === '"') value = value.replace(/\\n/g, '\n')
    } else {
      value = value.replace(/\s+#.*$/, '')
    }
    values[key] = value
  }
  return values
}

export function loadWorkspaceEnv(): void {
  if (loaded) return
  loaded = true

  let contents: string
  try {
    contents = readFileSync(workspaceEnvFile(), 'utf-8')
  } catch {
    return
  }

  for (const [key, value] of Object.entries(parseEnvFile(contents))) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}
