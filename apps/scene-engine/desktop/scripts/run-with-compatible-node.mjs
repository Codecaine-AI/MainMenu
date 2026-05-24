import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const minimum = [18, 18, 0]

function parseVersion(value) {
  return value
    .replace(/^v/, '')
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0)
}

function isCompatible(version) {
  const parts = parseVersion(version)
  for (let i = 0; i < minimum.length; i += 1) {
    if (parts[i] > minimum[i]) return true
    if (parts[i] < minimum[i]) return false
  }
  return true
}

function nodeVersion(executable) {
  const result = spawnSync(executable, ['-p', 'process.version'], {
    encoding: 'utf-8',
  })
  return result.status === 0 ? result.stdout.trim() : null
}

function chooseNode() {
  if (isCompatible(process.version)) return process.execPath

  const candidates = [
    process.env.MAIN_MENU_NODE,
    process.env.NVM_BIN ? path.join(process.env.NVM_BIN, 'node') : undefined,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const version = nodeVersion(candidate)
    if (version && isCompatible(version)) return candidate
  }

  return process.execPath
}

const [script, ...scriptArgs] = process.argv.slice(2)
if (!script) {
  console.error('Usage: node desktop/scripts/run-with-compatible-node.mjs <script> [...args]')
  process.exit(2)
}

const child = spawn(chooseNode(), [script, ...scriptArgs], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
