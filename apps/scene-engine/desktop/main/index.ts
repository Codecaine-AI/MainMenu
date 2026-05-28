import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { get } from 'node:http'
import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  MainMenuAgentContext,
  MainMenuAgentMessage,
  MainMenuAgentPromptRequest,
  MainMenuAgentState,
  MainMenuAppInfo,
} from '../types/main-menu'

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
let agentSession: import('@mariozechner/pi-coding-agent').AgentSession | null = null
let agentUnsubscribe: (() => void) | null = null
let agentMessages: MainMenuAgentMessage[] = []
let agentStatus: MainMenuAgentState['status'] = 'idle'
let agentCwd: string | null = null
let agentSessionId: string | null = null
let agentSessionFile: string | null = null
let activeTool: string | null = null
let agentError: string | null = null
let activeAssistantMessageId: string | null = null
let messageSequence = 0

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

function editableWorkspaceRoot() {
  if (app.isPackaged && runtime?.workspacePath) return runtime.workspacePath
  return packageRoot()
}

function rendererUrlFromOrigin(origin: string) {
  const startPath = process.env.MAIN_MENU_START_PATH ?? DEFAULT_START_PATH
  return new URL(startPath, origin).toString()
}

function nextMessageId(prefix: string) {
  messageSequence += 1
  return `${prefix}-${Date.now().toString(36)}-${messageSequence.toString(36)}`
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      const block = part as { type?: string; text?: string; thinking?: string; name?: string }
      if (block.type === 'text') return block.text ?? ''
      if (block.type === 'thinking') return block.thinking ? '[thinking]' : ''
      if (block.type === 'toolCall') return block.name ? `[tool: ${block.name}]` : '[tool]'
      if (block.type === 'image') return '[image]'
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function textFromAgentMessage(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const typed = message as { content?: unknown; errorMessage?: string }
  return textFromContent(typed.content) || typed.errorMessage || ''
}

function addAgentMessage(role: MainMenuAgentMessage['role'], text: string) {
  const message: MainMenuAgentMessage = {
    id: nextMessageId(role),
    role,
    text,
    timestamp: Date.now(),
  }
  agentMessages = [...agentMessages, message].slice(-80)
  return message
}

function updateAgentMessage(id: string, text: string) {
  agentMessages = agentMessages.map((message) => (message.id === id ? { ...message, text } : message))
}

function appendAgentMessageText(id: string, delta: string) {
  agentMessages = agentMessages.map((message) =>
    message.id === id ? { ...message, text: `${message.text}${delta}` } : message,
  )
}

function agentState(): MainMenuAgentState {
  return {
    status: agentStatus,
    messages: agentMessages,
    cwd: agentCwd,
    sessionId: agentSessionId,
    sessionFile: agentSessionFile,
    activeTool,
    error: agentError,
  }
}

function broadcastAgentState() {
  mainWindow?.webContents.send('main-menu:agent:event', { type: 'state', state: agentState() })
}

function importPiSdk(): Promise<typeof import('@mariozechner/pi-coding-agent')> {
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<typeof import('@mariozechner/pi-coding-agent')>
  return dynamicImport('@mariozechner/pi-coding-agent')
}

function formatAgentPrompt(request: MainMenuAgentPromptRequest) {
  const context: MainMenuAgentContext = request.context ?? {
    projectId: null,
    sceneId: 'unknown',
    selectedPath: null,
    selectedName: null,
    selectedType: null,
  }
  return [
    'You are Pi running inside the Main Menu desktop editor.',
    `Working directory: ${agentCwd ?? editableWorkspaceRoot()}`,
    `Project: ${context.projectId ?? 'default'}`,
    `Scene: ${context.sceneId}`,
    `Selected layer path: ${context.selectedPath ?? 'none'}`,
    `Selected layer: ${context.selectedName ?? 'none'}`,
    `Selected type: ${context.selectedType ?? 'none'}`,
    '',
    'Use the repository files and scene JSON to make requested edits. Keep changes scoped to the current Main Menu scene engine project, prefer existing APIs and file formats, and report the concrete files changed.',
    '',
    request.message.trim(),
  ].join('\n')
}

function handlePiEvent(event: import('@mariozechner/pi-coding-agent').AgentSessionEvent) {
  if (event.type === 'agent_start') {
    agentStatus = 'running'
    agentError = null
    activeTool = null
    activeAssistantMessageId = null
  } else if (event.type === 'message_start') {
    const message = event.message as { role?: string }
    if (message.role === 'assistant') {
      activeAssistantMessageId = addAgentMessage('assistant', '').id
    }
  } else if (event.type === 'message_update') {
    if (event.assistantMessageEvent.type === 'text_delta') {
      if (!activeAssistantMessageId) {
        activeAssistantMessageId = addAgentMessage('assistant', '').id
      }
      appendAgentMessageText(activeAssistantMessageId, event.assistantMessageEvent.delta)
    }
  } else if (event.type === 'message_end') {
    const message = event.message as { role?: string }
    if (message.role === 'assistant') {
      const text = textFromAgentMessage(event.message)
      if (activeAssistantMessageId && text) updateAgentMessage(activeAssistantMessageId, text)
      activeAssistantMessageId = null
    }
  } else if (event.type === 'tool_execution_start') {
    activeTool = event.toolName
    addAgentMessage('tool', `Running ${event.toolName}`)
  } else if (event.type === 'tool_execution_end') {
    addAgentMessage('tool', `${event.toolName} ${event.isError ? 'failed' : 'finished'}`)
    activeTool = null
  } else if (event.type === 'agent_end') {
    agentStatus = 'idle'
    activeTool = null
    activeAssistantMessageId = null
  } else if (event.type === 'compaction_start') {
    addAgentMessage('system', 'Compacting session context')
  } else if (event.type === 'compaction_end') {
    if (event.errorMessage) addAgentMessage('error', event.errorMessage)
  }

  broadcastAgentState()
}

async function ensurePiAgentSession() {
  if (agentSession) return agentSession

  agentStatus = 'starting'
  agentError = null
  agentCwd = editableWorkspaceRoot()
  broadcastAgentState()

  try {
    const sdk = await importPiSdk()
    const sessionDir = path.join(app.getPath('userData'), 'pi-agent-sessions')
    await fs.mkdir(sessionDir, { recursive: true })

    const result = await sdk.createAgentSession({
      cwd: agentCwd,
      sessionManager: sdk.SessionManager.create(agentCwd, sessionDir),
    })

    agentSession = result.session
    agentSessionId = result.session.sessionId
    agentSessionFile = result.session.sessionFile ?? null
    agentUnsubscribe = result.session.subscribe(handlePiEvent)

    addAgentMessage('system', `Pi session ready in ${agentCwd}`)
    if (result.modelFallbackMessage) addAgentMessage('system', result.modelFallbackMessage)
    agentStatus = 'idle'
    broadcastAgentState()
    return result.session
  } catch (error) {
    agentStatus = 'error'
    agentError = normalizeError(error)
    addAgentMessage('error', agentError)
    broadcastAgentState()
    throw error
  }
}

async function sendPiAgentMessage(request: MainMenuAgentPromptRequest): Promise<MainMenuAgentState> {
  const message = typeof request?.message === 'string' ? request.message.trim() : ''
  if (message.length === 0) throw new Error('Message is required')

  addAgentMessage('user', message)
  agentStatus = 'running'
  agentError = null
  broadcastAgentState()

  try {
    const session = await ensurePiAgentSession()
    const prompt = formatAgentPrompt({ ...request, message })
    const options = session.isStreaming ? { streamingBehavior: 'steer' as const } : undefined
    void session.prompt(prompt, options).catch((error: unknown) => {
      agentStatus = 'error'
      agentError = normalizeError(error)
      activeTool = null
      activeAssistantMessageId = null
      addAgentMessage('error', agentError)
      broadcastAgentState()
    })
  } catch (error) {
    agentStatus = 'error'
    agentError = normalizeError(error)
    addAgentMessage('error', agentError)
    broadcastAgentState()
  }

  return agentState()
}

async function abortPiAgent(): Promise<MainMenuAgentState> {
  if (agentSession) await agentSession.abort()
  agentStatus = 'idle'
  activeTool = null
  addAgentMessage('system', 'Stopped')
  broadcastAgentState()
  return agentState()
}

async function resetPiAgent(): Promise<MainMenuAgentState> {
  agentUnsubscribe?.()
  agentSession?.dispose()
  agentSession = null
  agentUnsubscribe = null
  agentMessages = []
  agentStatus = 'idle'
  agentCwd = null
  agentSessionId = null
  agentSessionFile = null
  activeTool = null
  agentError = null
  activeAssistantMessageId = null
  broadcastAgentState()
  return agentState()
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
  await fs.mkdir(workspacePath, { recursive: true })
  await ensureSeededDirectory(
    path.join(seedRoot, 'workspace.catalog.example.json'),
    path.join(workspacePath, 'workspace.catalog.example.json'),
  )
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
      SCENE_ENGINE_WORKSPACE_CATALOG: path.join(workspacePath, 'workspace.catalog.json'),
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
    workspacePath: packageRoot(),
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
  ipcMain.handle('main-menu:agent:get-state', () => agentState())
  ipcMain.handle('main-menu:agent:send-message', (_event, request) =>
    sendPiAgentMessage(request as MainMenuAgentPromptRequest),
  )
  ipcMain.handle('main-menu:agent:abort', () => abortPiAgent())
  ipcMain.handle('main-menu:agent:reset', () => resetPiAgent())

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
  agentUnsubscribe?.()
  agentSession?.dispose()
  runtime?.stop()
})

void app.whenReady().then(boot).catch((error) => {
  console.error(`[${PRODUCT_NAME}] Failed to start`, error)
  app.quit()
})
