import { spawn } from 'node:child_process'
import { get } from 'node:http'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const defaultOrigin = process.env.MAIN_MENU_DEV_SERVER_URL ?? 'http://localhost:3000'
const defaultStartPath = process.env.MAIN_MENU_START_PATH ?? '/editor?project=codecaine&scene=title'
const electronBin = path.join(projectRoot, 'node_modules/.bin/electron')

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: false,
      ...options,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

function probe(url) {
  return new Promise((resolve) => {
    const request = get(url, (response) => {
      response.resume()
      resolve(Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 500))
    })
    request.setTimeout(1000, () => {
      request.destroy()
      resolve(false)
    })
    request.on('error', () => resolve(false))
  })
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await probe(url)) return
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to allocate local port')))
        return
      }
      server.close(() => resolve(address.port))
    })
  })
}

function startDevServer(port) {
  return spawn('node', ['desktop/scripts/run-with-compatible-node.mjs', 'node_modules/next/dist/bin/next', 'dev', '-p', String(port)], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  })
}

function stop(child) {
  if (!child || child.killed) return
  child.kill()
}

await run('npm', ['run', 'desktop:compile'])

let devServer = null
let activeOrigin = defaultOrigin
if (!(await probe(defaultOrigin))) {
  const port = await getFreePort()
  activeOrigin = `http://127.0.0.1:${port}`
  devServer = startDevServer(port)
  await waitForServer(activeOrigin)
}

const rendererUrl = process.env.MAIN_MENU_RENDERER_URL ?? new URL(defaultStartPath, activeOrigin).toString()

const electron = spawn(electronBin, ['desktop/dist/main/index.js'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    MAIN_MENU_RENDERER_URL: rendererUrl,
  },
})

const shutdown = () => {
  stop(electron)
  stop(devServer)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

electron.on('exit', (code) => {
  stop(devServer)
  process.exit(code ?? 0)
})
