import { existsSync } from 'node:fs'
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { resolveProjectPaths } from '@/lib/project-paths'
import { discoverProjects, loadProject as loadSceneProject } from '@/lib/scenes'
import { buildSplitPromptDraftPrompt } from './split-prompt-draft'
import { assertSafeId, nowIso, splitInstructionLabel, uniqueId } from './ids'
import type {
  CatalogSuggestion,
  ExtractionNode,
  ExtractionProject,
  ExtractionScreen,
  ExtractionSplit,
  ProjectScreenRef,
  ProjectSummary,
  ScreenWorkspaceData,
  SplitPromptDraft,
} from './types'

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

function helperRoot(projectId: string) {
  const safeProjectId = assertSafeId(projectId, 'project id')
  const projectPaths = resolveProjectPaths(safeProjectId)
  if (!projectPaths) throw new Error(`Project not found: ${safeProjectId}`)

  return path.join(projectPaths.root, 'ProjectSettings', 'helpers', 'asset-extraction')
}

function projectDir(projectId: string) {
  return helperRoot(projectId)
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

async function loadSplitWithPrompts(
  projectId: string,
  screenId: string,
  splitId: string,
): Promise<ExtractionSplit> {
  const split = await readJson<ExtractionSplit>(splitJsonPath(projectId, screenId, splitId))
  const splitPath = splitDir(projectId, screenId, splitId)
  const [targetPrompt, residualPrompt] = await Promise.all([
    readFile(path.join(splitPath, 'target-prompt.txt'), 'utf8').catch(() => split.targetPrompt),
    readFile(path.join(splitPath, 'residual-prompt.txt'), 'utf8').catch(() => split.residualPrompt),
  ])

  return {
    ...split,
    targetPrompt: targetPrompt?.trim(),
    residualPrompt: residualPrompt?.trim(),
  }
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
  const summaries: ProjectSummary[] = []
  for (const descriptor of discoverProjects()) {
    const projectPath = projectJsonPath(descriptor.id)
    if (!existsSync(projectPath)) continue
    const project = await readJson<ExtractionProject>(projectPath).catch(() => null)
    if (!project) continue
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

export async function ensureExtractionProject(projectId: string): Promise<ExtractionProject> {
  const existing = await loadProject(projectId)
  if (existing) return existing

  const sceneProject = loadSceneProject(projectId)
  if (!sceneProject) throw new Error(`Project not found: ${projectId}`)

  const timestamp = nowIso()
  const project: ExtractionProject = {
    id: assertSafeId(projectId, 'project id'),
    name: sceneProject.name ?? projectId,
    screens: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await writeJson(projectJsonPath(project.id), project)
  return project
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
    screen.splitOrder.map(async (splitId) => loadSplitWithPrompts(projectId, screenId, splitId)),
  )

  return { project, screen, nodes, splits }
}

export async function createProject(name: string): Promise<ExtractionProject> {
  const match = discoverProjects().find((project) => project.name === name || project.id === name)
  if (!match) {
    throw new Error('Extraction workspaces are now created from an existing Scene Engine project.')
  }
  return ensureExtractionProject(match.id)
}

export async function updateProjectName(
  projectId: string,
  name: string,
): Promise<ExtractionProject> {
  const project = await loadProject(projectId)
  if (!project) throw new Error(`Project not found: ${projectId}`)

  const cleanedName = name.trim()
  if (!cleanedName) throw new Error('Project name is required.')

  const updated: ExtractionProject = {
    ...project,
    name: cleanedName,
    updatedAt: nowIso(),
  }
  await writeJson(projectJsonPath(projectId), updated)
  return updated
}

export async function createScreen(
  projectId: string,
  name: string,
  file: UploadedImageFile,
): Promise<ExtractionScreen> {
  const project = await ensureExtractionProject(projectId)
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
  targetPrompt: string
  residualPrompt: string
}): Promise<ScreenWorkspaceData> {
  const screen = await loadScreen(input.projectId, input.screenId)
  const project = await loadProject(input.projectId)
  const parent = await loadNode(input.projectId, input.screenId, input.parentNodeId)
  if (!project || !screen || !parent) throw new Error('Project, screen, or parent node was not found.')

  const instruction = input.instruction.trim()
  if (!instruction) throw new Error('Split instruction is required.')

  const existingSplits = await Promise.all(
    screen.splitOrder.map(async (splitId) =>
      readJson<ExtractionSplit>(splitJsonPath(input.projectId, input.screenId, splitId)),
    ),
  )
  const existingChildSplit = existingSplits.find((split) => split.parentNodeId === parent.id)
  if (existingChildSplit) {
    throw new Error('This image already has a split. Select its target or residual child to continue decomposing.')
  }

  const timestamp = nowIso()
  const nextNumber = screen.splitOrder.length + 1
  const splitId = uniqueId(`split-${String(nextNumber).padStart(3, '0')}`, (candidate) =>
    screen.splitOrder.includes(candidate),
  )
  const baseLabel = splitInstructionLabel(instruction)
  const targetNodeId = `${splitId}-target`
  const residualNodeId = `${splitId}-residual`
  const targetPrompt = input.targetPrompt?.trim()
  const residualPrompt = input.residualPrompt?.trim()
  if (!targetPrompt || !residualPrompt) {
    throw new Error('Target and residual prompts are required. Draft prompts before confirming the split.')
  }

  const parentImage = nodeImageFile(input.projectId, input.screenId, parent)
  const targetImagePath = path.join('nodes', targetNodeId, 'image.png')
  const residualImagePath = path.join('nodes', residualNodeId, 'image.png')

  const targetNode: ExtractionNode = {
    id: targetNodeId,
    projectId: input.projectId,
    screenId: input.screenId,
    parentId: parent.id,
    splitId,
    kind: 'target',
    label: `Target: ${baseLabel}`,
    imagePath: targetImagePath,
    depth: parent.depth + 1,
    status: 'generated',
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
    imagePath: residualImagePath,
    depth: parent.depth + 1,
    status: 'generated',
    instruction,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await mkdir(nodeDir(input.projectId, input.screenId, targetNode.id), { recursive: true })
  await mkdir(nodeDir(input.projectId, input.screenId, residualNode.id), { recursive: true })
  let imageEditMetadata: Awaited<ReturnType<typeof runSplitImageEdits>>
  try {
    imageEditMetadata = await runSplitImageEdits({
      sourceImagePath: parentImage,
      targetPrompt,
      residualPrompt,
      targetOutputPath: nodeImageFile(input.projectId, input.screenId, targetNode),
      residualOutputPath: nodeImageFile(input.projectId, input.screenId, residualNode),
    })
  } catch (err) {
    await Promise.all([
      rm(nodeDir(input.projectId, input.screenId, targetNode.id), { recursive: true, force: true }),
      rm(nodeDir(input.projectId, input.screenId, residualNode.id), { recursive: true, force: true }),
    ])
    throw err
  }
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
    status: 'generated',
    targetPrompt,
    residualPrompt,
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
    prompts: {
      target: targetPrompt,
      residual: residualPrompt,
    },
    image_generation: imageEditMetadata,
  })
  await writeFile(path.join(splitPath, 'target-prompt.txt'), targetPrompt, 'utf8')
  await writeFile(path.join(splitPath, 'residual-prompt.txt'), residualPrompt, 'utf8')

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

export async function draftSplitPrompts(input: {
  projectId: string
  screenId: string
  parentNodeId: string
  instruction: string
}): Promise<SplitPromptDraft> {
  const screen = await loadScreen(input.projectId, input.screenId)
  const project = await loadProject(input.projectId)
  const parent = await loadNode(input.projectId, input.screenId, input.parentNodeId)
  if (!project || !screen || !parent) throw new Error('Project, screen, or parent node was not found.')

  const instruction = input.instruction.trim()
  if (!instruction) throw new Error('Split instruction is required.')

  const splits = await Promise.all(
    screen.splitOrder.map(async (splitId) =>
      readJson<ExtractionSplit>(splitJsonPath(input.projectId, input.screenId, splitId)),
    ),
  )
  if (splits.some((split) => split.parentNodeId === parent.id)) {
    throw new Error('This image already has a split. Select its target or residual child to continue decomposing.')
  }

  return draftSplitPromptsWithModel({
    projectId: input.projectId,
    screenId: input.screenId,
    parent,
    instruction,
  })
}

export async function generateNodeSplitImages(input: {
  projectId: string
  screenId: string
  parentNodeId: string
}): Promise<ScreenWorkspaceData> {
  const screen = await loadScreen(input.projectId, input.screenId)
  const project = await loadProject(input.projectId)
  const parent = await loadNode(input.projectId, input.screenId, input.parentNodeId)
  if (!project || !screen || !parent) throw new Error('Project, screen, or parent node was not found.')

  const splits = await Promise.all(
    screen.splitOrder.map(async (splitId) => loadSplitWithPrompts(input.projectId, input.screenId, splitId)),
  )
  const split = splits.find((candidate) => candidate.parentNodeId === parent.id)
  if (!split) throw new Error('This image does not have a split to generate.')

  const targetNode = await loadNode(input.projectId, input.screenId, split.targetNodeId)
  const residualNode = await loadNode(input.projectId, input.screenId, split.residualNodeId)
  if (!targetNode || !residualNode) throw new Error('Split target or residual node was not found.')

  const splitPath = splitDir(input.projectId, input.screenId, split.id)
  const targetPrompt = split.targetPrompt?.trim()
  const residualPrompt = split.residualPrompt?.trim()
  if (!targetPrompt || !residualPrompt) {
    throw new Error('Split image generation requires the saved target and residual prompts.')
  }

  const timestamp = nowIso()
  const updatedTargetNode: ExtractionNode = {
    ...targetNode,
    imagePath: path.join('nodes', targetNode.id, 'image.png'),
    status: 'generated',
    updatedAt: timestamp,
  }
  const updatedResidualNode: ExtractionNode = {
    ...residualNode,
    imagePath: path.join('nodes', residualNode.id, 'image.png'),
    status: 'generated',
    updatedAt: timestamp,
  }

  const imageEditMetadata = await runSplitImageEdits({
    sourceImagePath: nodeImageFile(input.projectId, input.screenId, parent),
    targetPrompt: targetPrompt.trim(),
    residualPrompt: residualPrompt.trim(),
    targetOutputPath: nodeImageFile(input.projectId, input.screenId, updatedTargetNode),
    residualOutputPath: nodeImageFile(input.projectId, input.screenId, updatedResidualNode),
  })

  const updatedSplit: ExtractionSplit = {
    ...split,
    status: 'generated',
    updatedAt: timestamp,
  }

  await writeJson(nodeJsonPath(input.projectId, input.screenId, updatedTargetNode.id), updatedTargetNode)
  await writeJson(nodeJsonPath(input.projectId, input.screenId, updatedResidualNode.id), updatedResidualNode)
  await writeJson(splitJsonPath(input.projectId, input.screenId, updatedSplit.id), updatedSplit)
  await writeJson(path.join(splitPath, 'generation-result.json'), imageEditMetadata)
  await touchProjectScreen(input.projectId, input.screenId, timestamp)

  const workspace = await loadWorkspace(input.projectId, input.screenId)
  if (!workspace) throw new Error('Failed to reload workspace after generating split images.')
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

export async function deleteNodeSplit(input: {
  projectId: string
  screenId: string
  parentNodeId: string
}): Promise<ScreenWorkspaceData> {
  const screen = await loadScreen(input.projectId, input.screenId)
  const project = await loadProject(input.projectId)
  const parent = await loadNode(input.projectId, input.screenId, input.parentNodeId)
  if (!project || !screen || !parent) throw new Error('Project, screen, or parent node was not found.')

  const splits = await Promise.all(
    screen.splitOrder.map(async (splitId) =>
      readJson<ExtractionSplit>(splitJsonPath(input.projectId, input.screenId, splitId)),
    ),
  )
  const initialSplits = splits.filter((split) => split.parentNodeId === parent.id)
  if (initialSplits.length === 0) {
    throw new Error('This image does not have a split to delete.')
  }

  const splitsByParent = new Map<string, ExtractionSplit[]>()
  for (const split of splits) {
    const current = splitsByParent.get(split.parentNodeId) ?? []
    current.push(split)
    splitsByParent.set(split.parentNodeId, current)
  }

  const splitIdsToDelete = new Set<string>()
  const nodeIdsToDelete = new Set<string>()

  function markSplit(split: ExtractionSplit) {
    if (splitIdsToDelete.has(split.id)) return
    splitIdsToDelete.add(split.id)

    for (const nodeId of [split.targetNodeId, split.residualNodeId]) {
      nodeIdsToDelete.add(nodeId)
      for (const childSplit of splitsByParent.get(nodeId) ?? []) {
        markSplit(childSplit)
      }
    }
  }

  for (const split of initialSplits) {
    markSplit(split)
  }

  const timestamp = nowIso()
  const updatedScreen: ExtractionScreen = {
    ...screen,
    nodeOrder: screen.nodeOrder.filter((nodeId) => !nodeIdsToDelete.has(nodeId)),
    splitOrder: screen.splitOrder.filter((splitId) => !splitIdsToDelete.has(splitId)),
    updatedAt: timestamp,
  }

  await writeJson(screenJsonPath(input.projectId, input.screenId), updatedScreen)
  await Promise.all(
    [...splitIdsToDelete].map((splitId) =>
      rm(splitDir(input.projectId, input.screenId, splitId), { recursive: true, force: true }),
    ),
  )
  await Promise.all(
    [...nodeIdsToDelete].map((nodeId) =>
      rm(nodeDir(input.projectId, input.screenId, nodeId), { recursive: true, force: true }),
    ),
  )
  await touchProjectScreen(input.projectId, input.screenId, timestamp)

  const workspace = await loadWorkspace(input.projectId, input.screenId)
  if (!workspace) throw new Error('Failed to reload workspace after deleting split.')
  return workspace
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

async function runSplitImageEdits(input: {
  sourceImagePath: string
  targetPrompt: string
  residualPrompt: string
  targetOutputPath: string
  residualOutputPath: string
}) {
  if (process.env.ASSET_PIPELINE_IMAGE_MODE === 'placeholder') {
    await Promise.all([
      copyFile(input.sourceImagePath, input.targetOutputPath),
      copyFile(input.sourceImagePath, input.residualOutputPath),
    ])
    return {
      mode: 'placeholder',
      model: null,
      size: null,
      quality: null,
      output_format: null,
    }
  }

  const model = process.env.ASSET_PIPELINE_IMAGE_MODEL ?? 'gpt-image-2'
  const size = process.env.ASSET_PIPELINE_IMAGE_SIZE ?? 'auto'
  const quality = process.env.ASSET_PIPELINE_IMAGE_QUALITY ?? 'high'
  const outputFormat = 'png'

  const [targetResult, residualResult] = await Promise.all([
    editImageWithOpenAI({
      sourceImagePath: input.sourceImagePath,
      prompt: input.targetPrompt,
      outputPath: input.targetOutputPath,
      model,
      size,
      quality,
      outputFormat,
    }),
    editImageWithOpenAI({
      sourceImagePath: input.sourceImagePath,
      prompt: input.residualPrompt,
      outputPath: input.residualOutputPath,
      model,
      size,
      quality,
      outputFormat,
    }),
  ])

  return {
    mode: 'openai-image-edit',
    model,
    size,
    quality,
    output_format: outputFormat,
    target: targetResult,
    residual: residualResult,
  }
}

async function editImageWithOpenAI(input: {
  sourceImagePath: string
  prompt: string
  outputPath: string
  model: string
  size: string
  quality: string
  outputFormat: 'png'
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is required to generate split images. Set ASSET_PIPELINE_IMAGE_MODE=placeholder to create placeholder copies instead.',
    )
  }

  const sourceBytes = await readFile(input.sourceImagePath)
  const form = new FormData()
  form.append('model', input.model)
  form.append('prompt', input.prompt)
  form.append(
    'image',
    new Blob([new Uint8Array(sourceBytes)], {
      type: contentTypeForPath(input.sourceImagePath),
    }),
    path.basename(input.sourceImagePath),
  )
  if (input.size) form.append('size', input.size)
  if (input.quality) form.append('quality', input.quality)
  form.append('output_format', input.outputFormat)

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })
  const responseText = await response.text()
  const payload = (responseText
    ? safeJsonParse(responseText)
    : {}) as {
    data?: Array<{ b64_json?: string }>
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(
      `Image edit failed: ${response.status}${payload.error?.message ? ` ${payload.error.message}` : ''}`,
    )
  }

  const imageBase64 = payload.data?.[0]?.b64_json
  if (!imageBase64) throw new Error('Image edit response did not include image data.')

  await writeFile(input.outputPath, Buffer.from(imageBase64, 'base64'))
  return {
    bytes: Buffer.byteLength(imageBase64, 'base64'),
  }
}

async function draftSplitPromptsWithModel(input: {
  projectId: string
  screenId: string
  parent: ExtractionNode
  instruction: string
}): Promise<SplitPromptDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required to draft target and residual prompts.')
  }

  const model = process.env.ASSET_PIPELINE_PROMPT_MODEL ?? 'claude-opus-4-7'
  const parentImagePath = nodeImageFile(input.projectId, input.screenId, input.parent)
  const imageBytes = await readFile(parentImagePath)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: contentTypeForPath(parentImagePath),
                data: imageBytes.toString('base64'),
              },
            },
            { type: 'text', text: buildSplitPromptDraftPrompt(input.instruction) },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Anthropic prompt draft call failed: ${response.status}${detail ? ` ${detail}` : ''}`)
  }

  const payload = (await response.json()) as unknown
  const text = extractResponseText(payload)
  const parsed = safeJsonParse(extractJsonObjectText(text)) as {
    targetPrompt?: unknown
    residualPrompt?: unknown
  }
  if (typeof parsed.targetPrompt !== 'string' || typeof parsed.residualPrompt !== 'string') {
    throw new Error('Prompt draft model response did not include target and residual prompts.')
  }

  return {
    parentNodeId: input.parent.id,
    instruction: input.instruction,
    targetPrompt: parsed.targetPrompt.trim(),
    residualPrompt: parsed.residualPrompt.trim(),
    source: 'model',
    model,
    createdAt: nowIso(),
  }
}

function extractResponseText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Prompt draft model returned an invalid response.')
  }
  const content = (payload as { content?: unknown }).content
  if (Array.isArray(content)) {
    const text = content
      .map((part) =>
        typeof part === 'object' && part !== null && typeof (part as { text?: unknown }).text === 'string'
          ? (part as { text: string }).text
          : '',
      )
      .join('')
      .trim()
    if (text) return text
  }

  const maybeOutputText = (payload as { output_text?: unknown }).output_text
  if (typeof maybeOutputText === 'string') return maybeOutputText

  const output = (payload as { output?: unknown }).output
  if (!Array.isArray(output)) {
    throw new Error('Prompt draft model response did not include output text.')
  }

  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const text = (part as { text?: unknown }).text
      if (typeof text === 'string') return text
    }
  }

  throw new Error('Prompt draft model response did not include output text.')
}

function extractJsonObjectText(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return candidate
  return candidate.slice(start, end + 1)
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { error: { message: text } }
  }
}

function contentTypeForPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  return 'image/png'
}
