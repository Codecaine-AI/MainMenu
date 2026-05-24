import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { get } from 'node:http'
import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { MainMenuAppInfo } from '../types/main-menu'

const PRODUCT_NAME = 'Main Menu'
const DEFAULT_START_PATH = '/editor?project=codecaine&scene=title'
const DEV_RENDERER_URL = 'http://localhost:3000'

interface RuntimeController {
  url: string
  workspacePath: string | null
  stop(): void
}

let runtime: RuntimeController | null = null
let mainWindow: BrowserWindow | null = null

function packageRoot() {
  return path.resolve(__dirname, '../../..')
}

function preloadPath() {
  return path.join(__dirname, '../preload/index.js')
}

function packageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(packageRoot(), 'package.json'), 'utf-8')) as { version?: string }
    return pkg.version ?? app.getVersion()
  } catch {
    return app.getVersion()
  }
}

function rendererUrlFromOrigin(origin: string) {
  const startPath = process.env.MAIN_MENU_START_PATH ?? DEFAULT_START_PATH
  return new URL(startPath, origin).toString()
}

function buildApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: PRODUCT_NAME,
      submenu: [
        { role: 'about', label: `About ${PRODUCT_NAME}` },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: `Hide ${PRODUCT_NAME}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: `Quit ${PRODUCT_NAME}` },
      ],
    },
    {
      label: 'File',
      submenu: [{ role: 'close' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }],
    },
  ]

  return Menu.buildFromTemplate(template)
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to allocate local port')))
        return
      }
      const { port } = address
      server.close(() => resolve(port))
    })
  })
}

function probe(url: string): Promise<boolean> {
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

async function waitForServer(url: string, timeoutMs = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await probe(url)) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for local Next server at ${url}`)
}

async function ensureSeededDirectory(source: string, target: string) {
  try {
    await fs.access(target)
    return
  } catch {
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.cp(source, target, { recursive: true })
  }
}

async function replaceSymlink(target: string, linkPath: string) {
  await fs.rm(linkPath, { recursive: true, force: true })
  await fs.symlink(target, linkPath, 'dir')
}

async function appendServerLog(logPath: string, prefix: string, chunk: Buffer) {
  const text = chunk
    .toString('utf-8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `${prefix} ${line}\n`)
    .join('')
  if (text) await fs.appendFile(logPath, text, 'utf-8')
}

async function createPackagedRuntime(): Promise<RuntimeController> {
  const resourcesRuntime = path.join(process.resourcesPath, 'next-runtime')
  const sourceRuntime = path.join(resourcesRuntime, 'runtime')
  const seedRoot = path.join(resourcesRuntime, 'seed')
  const userData = app.getPath('userData')
  const runtimeRoot = path.join(userData, 'runtime')
  const runtimeDir = path.join(runtimeRoot, app.getVersion())
  const workspacePath = path.join(userData, 'workspace')
  const logPath = path.join(userData, 'next-server.log')

  await fs.rm(runtimeDir, { recursive: true, force: true })
  await fs.mkdir(runtimeRoot, { recursive: true })
  await fs.cp(sourceRuntime, runtimeDir, { recursive: true })
  await ensureSeededDirectory(path.join(seedRoot, 'public'), path.join(workspacePath, 'public'))
  await ensureSeededDirectory(path.join(seedRoot, 'projects'), path.join(workspacePath, 'projects'))
  await replaceSymlink(path.join(workspacePath, 'public'), path.join(runtimeDir, 'public'))
  await replaceSymlink(path.join(workspacePath, 'projects'), path.join(runtimeDir, 'projects'))
  await fs.writeFile(logPath, `[${new Date().toISOString()}] Starting ${PRODUCT_NAME} Next server\n`, 'utf-8')

  const port = await getFreePort()
  const origin = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['server.js'], {
    cwd: runtimeDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk: Buffer) => {
    void appendServerLog(logPath, '[stdout]', chunk)
  })
  child.stderr.on('data', (chunk: Buffer) => {
    void appendServerLog(logPath, '[stderr]', chunk)
  })

  await waitForServer(origin)

  return {
    url: rendererUrlFromOrigin(origin),
    workspacePath,
    stop: () => stopChild(child),
  }
}

function createDevelopmentRuntime(): RuntimeController {
  const rendererUrl =
    process.env.MAIN_MENU_RENDERER_URL ?? rendererUrlFromOrigin(process.env.MAIN_MENU_DEV_SERVER_URL ?? DEV_RENDERER_URL)

  return {
    url: rendererUrl,
    workspacePath: path.join(packageRoot(), 'projects'),
    stop: () => undefined,
  }
}

function stopChild(child: ChildProcess) {
  if (child.killed) return
  child.kill()
}

function appInfo(): MainMenuAppInfo {
  return {
    productName: PRODUCT_NAME,
    version: packageVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
    workspacePath: runtime?.workspacePath ?? null,
    rendererUrl: runtime?.url ?? '',
  }
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: PRODUCT_NAME,
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#111111',
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow?.setTitle(PRODUCT_NAME)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  await mainWindow.loadURL(runtime!.url)
}

async function boot() {
  app.setName(PRODUCT_NAME)
  Menu.setApplicationMenu(buildApplicationMenu())

  ipcMain.handle('main-menu:app:get-info', () => appInfo())

  runtime = app.isPackaged ? await createPackagedRuntime() : createDevelopmentRuntime()
  await createMainWindow()
  console.log(`[${PRODUCT_NAME}] Loaded renderer ${runtime.url}`)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  runtime?.stop()
})

void app.whenReady().then(boot).catch((error) => {
  console.error(`[${PRODUCT_NAME}] Failed to start`, error)
  app.quit()
})
