#!/usr/bin/env node
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createGzip } from 'node:zlib'
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
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml'],
])

// Types that benefit from gzip compression
const COMPRESSIBLE_TYPES = new Set([
  'text/html',
  'text/javascript',
  'text/css',
  'application/json',
  'image/svg+xml',
  'text/plain',
  'application/xml',
  'application/wasm',
])

// Cache policy: fonts and media get long-lived cache; code and data get a short
// cache with stale-while-revalidate so navigations use cached copies instantly
// (revalidation happens in the background) instead of paying a 304 round trip per
// file; HTML stays no-cache so new deploys are picked up on the next page load.
const LONG_CACHE_EXTENSIONS = new Set([
  '.woff2', '.woff', '.otf', '.ttf',
  '.mp4', '.webm', '.mp3', '.wav',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.svg',
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

function cacheControl(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (LONG_CACHE_EXTENSIONS.has(ext)) {
    return 'public, max-age=86400, stale-while-revalidate=604800'
  }
  if (ext === '.html') {
    return 'no-cache'
  }
  return 'public, max-age=300, stale-while-revalidate=86400'
}

function isCompressible(mimeType) {
  const base = mimeType.split(';')[0].trim()
  return COMPRESSIBLE_TYPES.has(base)
}

function weakETag(size, mtimeMs) {
  return `W/"${size}-${Math.floor(mtimeMs).toString(16)}"`
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

  // Canonical redirect: strip trailing slash from non-root paths
  if (pathname !== '/' && pathname.endsWith('/')) {
    const canonical = pathname.slice(0, -1)
    return { status: 301, location: `${canonical}${requestUrl.search}` }
  }

  // Canonical redirect: /dir/index.html → /dir, /index.html → /
  if (pathname.endsWith('/index.html')) {
    const canonical = pathname.slice(0, -'/index.html'.length) || '/'
    return { status: 301, location: `${canonical}${requestUrl.search}` }
  }

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
    // Serve directory's index.html directly (no redirect, no trailing slash)
    const indexPath = path.join(filePath, 'index.html')
    try {
      const indexInfo = await stat(indexPath)
      if (indexInfo.isFile()) {
        return {
          status: 200,
          filePath: indexPath,
          size: indexInfo.size,
          mtimeMs: indexInfo.mtimeMs,
        }
      }
    } catch {
      // fall through to 404
    }
    return { status: 404, message: 'Not found' }
  }

  if (!info.isFile()) return { status: 404, message: 'Not found' }
  return { status: 200, filePath, size: info.size, mtimeMs: info.mtimeMs }
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

  const mime = contentType(resolved.filePath)
  const etag = weakETag(resolved.size, resolved.mtimeMs)
  const lastModified = new Date(resolved.mtimeMs).toUTCString()
  const cache = cacheControl(resolved.filePath)
  const compressible = isCompressible(mime)

  // Conditional request handling
  const ifNoneMatch = req.headers['if-none-match']
  const ifModifiedSince = req.headers['if-modified-since']

  if (ifNoneMatch) {
    if (ifNoneMatch === etag || ifNoneMatch === '*') {
      const headers = {
        'ETag': etag,
        'Last-Modified': lastModified,
        'Cache-Control': cache,
      }
      if (compressible) headers['Vary'] = 'Accept-Encoding'
      res.writeHead(304, headers)
      res.end()
      return
    }
  } else if (ifModifiedSince) {
    const since = Date.parse(ifModifiedSince)
    if (!Number.isNaN(since) && resolved.mtimeMs <= since + 999) {
      const headers = {
        'ETag': etag,
        'Last-Modified': lastModified,
        'Cache-Control': cache,
      }
      if (compressible) headers['Vary'] = 'Accept-Encoding'
      res.writeHead(304, headers)
      res.end()
      return
    }
  }

  // Determine if we should gzip this response
  const acceptEncoding = req.headers['accept-encoding'] || ''
  const wantsGzip = /\bgzip\b/.test(acceptEncoding)
  const shouldGzip = compressible && wantsGzip && resolved.size > 1024

  const responseHeaders = {
    'Content-Type': mime,
    'ETag': etag,
    'Last-Modified': lastModified,
    'Cache-Control': cache,
  }

  if (compressible) {
    responseHeaders['Vary'] = 'Accept-Encoding'
  }

  if (shouldGzip) {
    responseHeaders['Content-Encoding'] = 'gzip'
    // Omit Content-Length since compressed size differs
  } else {
    responseHeaders['Content-Length'] = resolved.size
  }

  res.writeHead(200, responseHeaders)

  if (req.method === 'HEAD') {
    res.end()
    return
  }

  const stream = createReadStream(resolved.filePath)
  stream.on('error', () => {
    if (!res.headersSent) sendText(res, 500, 'Internal server error\n')
    else res.destroy()
  })

  if (shouldGzip) {
    const gzip = createGzip()
    gzip.on('error', () => {
      res.destroy()
    })
    stream.pipe(gzip).pipe(res)
  } else {
    stream.pipe(res)
  }
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
