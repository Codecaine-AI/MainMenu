#!/usr/bin/env node
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.otf', 'font/otf'],
  ['.ttf', 'font/ttf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.wasm', 'application/wasm'],
])

function readOption(name, fallback) {
  const flag = `--${name}`
  const flagIndex = process.argv.indexOf(flag)
  if (flagIndex >= 0 && process.argv[flagIndex + 1]) return process.argv[flagIndex + 1]
  return process.env[name.toUpperCase()] || fallback
}

function contentType(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
}

function displayHost(host) {
  return host === '0.0.0.0' ? 'localhost' : host
}

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  })
  res.end(text)
}

async function resolveFile(requestUrl) {
  let pathname
  try {
    pathname = decodeURIComponent(requestUrl.pathname)
  } catch {
    return { status: 400, message: 'Bad request' }
  }

  if (pathname.includes('\0')) return { status: 400, message: 'Bad request' }

  let filePath = path.resolve(root, `.${pathname}`)
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    return { status: 403, message: 'Forbidden' }
  }

  let info
  try {
    info = await stat(filePath)
  } catch {
    return { status: 404, message: 'Not found' }
  }

  if (info.isDirectory()) {
    if (!pathname.endsWith('/')) {
      return {
        status: 301,
        location: `${pathname}/${requestUrl.search}`,
      }
    }
    filePath = path.join(filePath, 'index.html')
    try {
      info = await stat(filePath)
    } catch {
      return { status: 404, message: 'Not found' }
    }
  }

  if (!info.isFile()) return { status: 404, message: 'Not found' }
  return { status: 200, filePath, size: info.size }
}

const host = readOption('host', '127.0.0.1')
const port = Number.parseInt(readOption('port', '4173'), 10)

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`Invalid port: ${readOption('port', '4173')}`)
  process.exit(1)
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' })
    res.end()
    return
  }

  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const resolved = await resolveFile(requestUrl)

  if (resolved.status === 301) {
    res.writeHead(301, { Location: resolved.location })
    res.end()
    return
  }

  if (resolved.status !== 200) {
    sendText(res, resolved.status, `${resolved.message}\n`)
    return
  }

  res.writeHead(200, {
    'Content-Type': contentType(resolved.filePath),
    'Content-Length': resolved.size,
    'Cache-Control': 'no-cache',
  })

  if (req.method === 'HEAD') {
    res.end()
    return
  }

  const stream = createReadStream(resolved.filePath)
  stream.on('error', () => {
    if (!res.headersSent) sendText(res, 500, 'Internal server error\n')
    else res.destroy()
  })
  stream.pipe(res)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Try: make run PORT=${port + 1}`)
    process.exit(1)
  }
  console.error(err)
  process.exit(1)
})

server.listen(port, host, () => {
  console.log(`Serving ${root}`)
  console.log(`Open http://${displayHost(host)}:${port}/`)
})
