import { existsSync } from 'node:fs'
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { assertSafeId, nowIso, slugify, splitInstructionLabel, uniqueId } from './ids'
import type {
  CatalogSuggestion,
  ExtractionNode,
  ExtractionProject,
  ExtractionScreen,
  ExtractionSplit,
  ProjectScreenRef,
  ProjectSummary,
  ScreenWorkspaceData,
} from './types'

const WORKSPACE_DIR = path.join(process.cwd(), 'workspace')
const PROJECTS_DIR = path.join(WORKSPACE_DIR, 'projects')

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export interface UploadedImageFile {
  name: string
  type: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

function projectDir(projectId: string) {
  return path.join(PROJECTS_DIR, assertSafeId(projectId, 'project id'))
}

function projectJsonPath(projectId: string) {
  return path.join(projectDir(projectId), 'project.json')
}

function screenDir(projectId: string, screenId: string) {
  return path.join(projectDir(projectId), 'screens', assertSafeId(screenId, 'screen id'))
}

function screenJsonPath(projectId: string, screenId: string) {
  return path.join(screenDir(projectId, screenId), 'screen.json')
}

function nodeDir(projectId: string, screenId: string, nodeId: string) {
  return path.join(screenDir(projectId, screenId), 'nodes', assertSafeId(nodeId, 'node id'))
}

function nodeJsonPath(projectId: string, screenId: string, nodeId: string) {
  return path.join(nodeDir(projectId, screenId, nodeId), 'node.json')
}

function splitDir(projectId: string, screenId: string, splitId: string) {
  return path.join(screenDir(projectId, screenId), 'splits', assertSafeId(splitId, 'split id'))
}

function splitJsonPath(projectId: string, screenId: string, splitId: string) {
  return path.join(splitDir(projectId, screenId, splitId), 'split.json')
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function nodeImageFile(projectId: string, screenId: string, node: ExtractionNode) {
  return path.join(screenDir(projectId, screenId), node.imagePath)
}

function imageExtension(file: UploadedImageFile): string {
  const byMime = IMAGE_EXTENSIONS[file.type]
  if (byMime) return byMime

  const ext = path.extname(file.name).replace('.', '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext
  throw new Error('Source image must be PNG, JPEG, or WebP.')
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (!existsSync(PROJECTS_DIR)) return []

  const entries = await readdir(PROJECTS_DIR)
  const summaries: ProjectSummary[] = []
  for (const id of entries.sort()) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) continue
    const dir = projectDir(id)
    const info = await stat(dir).catch(() => null)
    if (!info?.isDirectory()) continue
    const projectPath = projectJsonPath(id)
    if (!existsSync(projectPath)) continue
    const project = await readJson<ExtractionProject>(projectPath)
    summaries.push({
      id: project.id,
      name: project.name,
      screenCount: project.screens.length,
      updatedAt: project.updatedAt,
    })
  }
  return summaries
}

export async function loadProject(projectId: string): Promise<ExtractionProject | null> {
  const filePath = projectJsonPath(projectId)
  if (!existsSync(filePath)) return null
  return readJson<ExtractionProject>(filePath)
}

export async function loadScreen(
  projectId: string,
  screenId: string,
): Promise<ExtractionScreen | null> {
  const filePath = screenJsonPath(projectId, screenId)
  if (!existsSync(filePath)) return null
  return readJson<ExtractionScreen>(filePath)
}

export async function loadNode(
  projectId: string,
  screenId: string,
  nodeId: string,
): Promise<ExtractionNode | null> {
  const filePath = nodeJsonPath(projectId, screenId, nodeId)
  if (!existsSync(filePath)) return null
  return readJson<ExtractionNode>(filePath)
}

export async function loadWorkspace(
  projectId: string,
  screenId: string,
): Promise<ScreenWorkspaceData | null> {
  const project = await loadProject(projectId)
  const screen = await loadScreen(projectId, screenId)
  if (!project || !screen) return null

  const nodes = await Promise.all(
    screen.nodeOrder.map(async (nodeId) => readJson<ExtractionNode>(nodeJsonPath(projectId, screenId, nodeId))),
  )
  const splits = await Promise.all(
    screen.splitOrder.map(async (splitId) => readJson<ExtractionSplit>(splitJsonPath(projectId, screenId, splitId))),
  )

  return { project, screen, nodes, splits }
}

export async function createProject(name: string): Promise<ExtractionProject> {
  const cleanedName = name.trim()
  if (!cleanedName) throw new Error('Project name is required.')

  await mkdir(PROJECTS_DIR, { recursive: true })
  const existing = new Set((await readdir(PROJECTS_DIR).catch(() => [])).filter(Boolean))
  const id = uniqueId(cleanedName, (candidate) => existing.has(candidate))
  const timestamp = nowIso()
  const project: ExtractionProject = {
    id,
    name: cleanedName,
    screens: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await writeJson(projectJsonPath(id), project)
  return project
}

export async function createScreen(
  projectId: string,
  name: string,
  file: UploadedImageFile,
): Promise<ExtractionScreen> {
  const project = await loadProject(projectId)
  if (!project) throw new Error(`Project not found: ${projectId}`)
  const cleanedName = name.trim()
  if (!cleanedName) throw new Error('Screen name is required.')

  const screenId = uniqueId(cleanedName, (candidate) =>
    project.screens.some((screen) => screen.id === candidate),
  )
  const dir = screenDir(projectId, screenId)
  await mkdir(path.join(dir, 'nodes'), { recursive: true })
  await mkdir(path.join(dir, 'splits'), { recursive: true })

  const ext = imageExtension(file)
  const sourceImage = `source.${ext}`
  await writeFile(path.join(dir, sourceImage), Buffer.from(await file.arrayBuffer()))

  const timestamp = nowIso()
  const rootNode: ExtractionNode = {
    id: 'root',
    projectId,
    screenId,
    parentId: null,
    splitId: null,
    kind: 'source',
    label: 'Source screen',
    imagePath: sourceImage,
    depth: 0,
    status: 'active',
    instruction: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await writeJson(nodeJsonPath(projectId, screenId, rootNode.id), rootNode)

  const screen: ExtractionScreen = {
    id: screenId,
    projectId,
    name: cleanedName,
    sourceImage,
    rootNodeId: rootNode.id,
    nodeOrder: [rootNode.id],
    splitOrder: [],
    catalogSuggestions: defaultCatalogSuggestions(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await writeJson(screenJsonPath(projectId, screenId), screen)

  const screenRef: ProjectScreenRef = {
    id: screen.id,
    name: screen.name,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const updatedProject: ExtractionProject = {
    ...project,
    screens: [...project.screens, screenRef],
    updatedAt: timestamp,
  }
  await writeJson(projectJsonPath(projectId), updatedProject)

  return screen
}

export async function createSplit(input: {
  projectId: string
  screenId: string
  parentNodeId: string
  instruction: string
}): Promise<ScreenWorkspaceData> {
  const screen = await loadScreen(input.projectId, input.screenId)
  const project = await loadProject(input.projectId)
  const parent = await loadNode(input.projectId, input.screenId, input.parentNodeId)
  if (!project || !screen || !parent) throw new Error('Project, screen, or parent node was not found.')

  const instruction = input.instruction.trim()
  if (!instruction) throw new Error('Split instruction is required.')

  const timestamp = nowIso()
  const nextNumber = screen.splitOrder.length + 1
  const splitId = uniqueId(`split-${String(nextNumber).padStart(3, '0')}`, (candidate) =>
    screen.splitOrder.includes(candidate),
  )
  const baseLabel = splitInstructionLabel(instruction)
  const targetNodeId = `${splitId}-target`
  const residualNodeId = `${splitId}-residual`

  const parentImage = nodeImageFile(input.projectId, input.screenId, parent)
  const ext = path.extname(parent.imagePath) || '.png'

  const targetNode: ExtractionNode = {
    id: targetNodeId,
    projectId: input.projectId,
    screenId: input.screenId,
    parentId: parent.id,
    splitId,
    kind: 'target',
    label: `Target: ${baseLabel}`,
    imagePath: path.join('nodes', targetNodeId, `image${ext}`),
    depth: parent.depth + 1,
    status: 'pending_model',
    instruction,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const residualNode: ExtractionNode = {
    id: residualNodeId,
    projectId: input.projectId,
    screenId: input.screenId,
    parentId: parent.id,
    splitId,
    kind: 'residual',
    label: `Residual after: ${baseLabel}`,
    imagePath: path.join('nodes', residualNodeId, `image${ext}`),
    depth: parent.depth + 1,
    status: 'pending_model',
    instruction,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await mkdir(nodeDir(input.projectId, input.screenId, targetNode.id), { recursive: true })
  await mkdir(nodeDir(input.projectId, input.screenId, residualNode.id), { recursive: true })
  await copyFile(parentImage, nodeImageFile(input.projectId, input.screenId, targetNode))
  await copyFile(parentImage, nodeImageFile(input.projectId, input.screenId, residualNode))
  await writeJson(nodeJsonPath(input.projectId, input.screenId, targetNode.id), targetNode)
  await writeJson(nodeJsonPath(input.projectId, input.screenId, residualNode.id), residualNode)

  const split: ExtractionSplit = {
    id: splitId,
    projectId: input.projectId,
    screenId: input.screenId,
    parentNodeId: parent.id,
    instruction,
    targetNodeId,
    residualNodeId,
    status: 'pending_model',
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const splitPath = splitDir(input.projectId, input.screenId, splitId)
  await mkdir(splitPath, { recursive: true })
  await writeJson(splitJsonPath(input.projectId, input.screenId, splitId), split)
  await writeJson(path.join(splitPath, 'request.json'), {
    split_id: splitId,
    parent_node_id: parent.id,
    instruction,
    outputs: {
      target_node_id: targetNode.id,
      residual_node_id: residualNode.id,
    },
  })
  await writeFile(path.join(splitPath, 'target-prompt.txt'), buildTargetPrompt(instruction), 'utf8')
  await writeFile(path.join(splitPath, 'residual-prompt.txt'), buildResidualPrompt(instruction), 'utf8')

  const updatedScreen: ExtractionScreen = {
    ...screen,
    nodeOrder: [...screen.nodeOrder, targetNode.id, residualNode.id],
    splitOrder: [...screen.splitOrder, split.id],
    updatedAt: timestamp,
  }
  await writeJson(screenJsonPath(input.projectId, input.screenId), updatedScreen)
  await touchProjectScreen(input.projectId, input.screenId, timestamp)

  const workspace = await loadWorkspace(input.projectId, input.screenId)
  if (!workspace) throw new Error('Failed to reload workspace after split.')
  return workspace
}

export async function setNodeFinal(input: {
  projectId: string
  screenId: string
  nodeId: string
  final: boolean
}): Promise<ExtractionNode> {
  const node = await loadNode(input.projectId, input.screenId, input.nodeId)
  if (!node) throw new Error(`Node not found: ${input.nodeId}`)
  const timestamp = nowIso()
  const updated: ExtractionNode = {
    ...node,
    status: input.final ? 'final' : 'active',
    updatedAt: timestamp,
  }
  await writeJson(nodeJsonPath(input.projectId, input.screenId, input.nodeId), updated)
  await touchProjectScreen(input.projectId, input.screenId, timestamp)
  return updated
}

export async function resolveNodeImage(
  projectId: string,
  screenId: string,
  nodeId: string,
): Promise<{ filePath: string; contentType: string } | null> {
  const node = await loadNode(projectId, screenId, nodeId)
  if (!node) return null
  const filePath = nodeImageFile(projectId, screenId, node)
  if (!existsSync(filePath)) return null

  const ext = path.extname(filePath).toLowerCase()
  const contentType =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.webp'
        ? 'image/webp'
        : 'image/png'
  return { filePath, contentType }
}

async function touchProjectScreen(projectId: string, screenId: string, timestamp: string) {
  const project = await loadProject(projectId)
  if (!project) return
  const updatedProject: ExtractionProject = {
    ...project,
    screens: project.screens.map((screen) =>
      screen.id === screenId ? { ...screen, updatedAt: timestamp } : screen,
    ),
    updatedAt: timestamp,
  }
  await writeJson(projectJsonPath(projectId), updatedProject)
}

function defaultCatalogSuggestions(): CatalogSuggestion[] {
  return [
    {
      id: 'background-vs-interface',
      label: 'Background vs interface',
      description: 'Start by splitting the back plate or animated field from the foreground UI.',
      instruction: 'extract the background layer behind the menu interface',
    },
    {
      id: 'primary-group',
      label: 'Primary grouped UI',
      description: 'Pull out the dominant menu assembly before breaking it into panels and buttons.',
      instruction: 'extract the main menu interface group',
    },
    {
      id: 'highlight-state',
      label: 'Highlight or selector',
      description: 'Separate the active-state artwork from the base menu item once the group is isolated.',
      instruction: 'extract the active highlight or selector overlay',
    },
  ]
}

function buildTargetPrompt(instruction: string): string {
  return [
    'You are splitting one visual asset out of the attached parent image.',
    `Target instruction: ${instruction}`,
    '',
    'Create the target output: preserve only the requested visual piece with high fidelity. Remove every unrelated element. Keep the extracted piece positioned and scaled consistently with the parent image unless the user later marks it for final tight export.',
  ].join('\n')
}

function buildResidualPrompt(instruction: string): string {
  return [
    'You are splitting one visual asset out of the attached parent image.',
    `Removed target instruction: ${instruction}`,
    '',
    'Create the residual output: preserve the parent image except remove the requested visual piece. Reconstruct the newly exposed surface from the surrounding visible context so the remaining scene reads as if the target piece was never present.',
  ].join('\n')
}
