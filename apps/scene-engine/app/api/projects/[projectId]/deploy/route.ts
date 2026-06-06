import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'
import { createProjectPaths, resolveProjectRootDescriptor } from '@/lib/project-paths'

const execFileAsync = promisify(execFile)
const GIT_TIMEOUT_MS = 120_000
const GIT_MAX_BUFFER = 1024 * 1024 * 8

interface DeployMarker {
  version: 1
  projectId: string
  sequence: number
  deployedAt: string
  source: 'scene-engine'
  note: string
}

function isLocalHost(hostHeader: string | null) {
  if (!hostHeader) return false
  const host = hostHeader.startsWith('[')
    ? hostHeader.slice(1, hostHeader.indexOf(']') > 0 ? hostHeader.indexOf(']') : undefined)
    : hostHeader.split(':')[0]
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

function assertLocalRequest(req: Request) {
  if (process.env.SCENE_ENGINE_ALLOW_REMOTE_DEPLOY === '1') return null
  if (isLocalHost(req.headers.get('host'))) return null
  return NextResponse.json(
    { error: 'Deploy is only available from localhost.' },
    { status: 403 },
  )
}

async function git(root: string, args: string[]) {
  const { stdout } = await execFileAsync('git', ['-C', root, ...args], {
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER,
  })
  return stdout.trim()
}

function errorMessage(err: unknown) {
  if (err && typeof err === 'object') {
    const candidate = err as { stderr?: unknown; stdout?: unknown; message?: unknown }
    const stderr = typeof candidate.stderr === 'string' ? candidate.stderr.trim() : ''
    const stdout = typeof candidate.stdout === 'string' ? candidate.stdout.trim() : ''
    const message = typeof candidate.message === 'string' ? candidate.message.trim() : ''
    return stderr || stdout || message || 'Deploy failed'
  }
  return 'Deploy failed'
}

function safeCommitMessage(projectId: string, requested: unknown, deployedAt: string) {
  if (typeof requested === 'string') {
    const trimmed = requested.trim().replace(/\s+/g, ' ')
    if (trimmed) return trimmed.slice(0, 120)
  }
  return `deploy: ${projectId} ${deployedAt.replace(/\.\d{3}Z$/, 'Z')}`
}

async function readPreviousSequence(markerFile: string) {
  if (!existsSync(markerFile)) return 0
  try {
    const parsed = JSON.parse(await readFile(markerFile, 'utf-8')) as Partial<DeployMarker>
    return typeof parsed.sequence === 'number' ? parsed.sequence : 0
  } catch {
    return 0
  }
}

async function writeDeployMarker(root: string, projectId: string) {
  const markerDir = path.join(root, 'ProjectSettings')
  const markerFile = path.join(markerDir, 'deployment.json')
  const sequence = await readPreviousSequence(markerFile) + 1
  const deployedAt = new Date().toISOString()
  const marker: DeployMarker = {
    version: 1,
    projectId,
    sequence,
    deployedAt,
    source: 'scene-engine',
    note: 'Updated by the Scene Engine deploy action to trigger GitHub/Railway deployment.',
  }

  await mkdir(markerDir, { recursive: true })
  await writeFile(markerFile, `${JSON.stringify(marker, null, 2)}\n`)

  return {
    marker,
    markerPath: path.relative(root, markerFile),
  }
}

async function hasUpstream(root: string) {
  try {
    await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
    return true
  } catch {
    return false
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const localError = assertLocalRequest(req)
  if (localError) return localError

  const { projectId } = await params
  const descriptor = resolveProjectRootDescriptor(projectId)
  if (!descriptor) {
    return NextResponse.json({ error: `Project not found: ${projectId}` }, { status: 404 })
  }

  const projectPaths = createProjectPaths(descriptor)
  const body = await req.json().catch(() => ({})) as { message?: unknown }

  try {
    const gitRoot = path.resolve(await git(projectPaths.root, ['rev-parse', '--show-toplevel']))
    const projectRoot = path.resolve(projectPaths.root)
    if (gitRoot !== projectRoot) {
      return NextResponse.json(
        { error: `Project root is not its own git repository: ${projectPaths.root}` },
        { status: 400 },
      )
    }

    const branch = await git(projectRoot, ['branch', '--show-current'])
    if (!branch) {
      return NextResponse.json(
        { error: 'Project repository is in detached HEAD state.' },
        { status: 400 },
      )
    }

    const { marker, markerPath } = await writeDeployMarker(projectRoot, projectId)
    const message = safeCommitMessage(projectId, body.message, marker.deployedAt)

    await git(projectRoot, ['add', '-A'])
    try {
      await git(projectRoot, ['diff', '--cached', '--quiet'])
      return NextResponse.json({
        ok: true,
        projectId,
        branch,
        marker,
        markerPath,
        committed: false,
        pushed: false,
        message: 'No changes to deploy.',
      })
    } catch {
      // `git diff --quiet` exits 1 when staged changes exist.
    }

    await git(projectRoot, ['commit', '-m', message])
    const commit = await git(projectRoot, ['rev-parse', 'HEAD'])
    if (await hasUpstream(projectRoot)) {
      await git(projectRoot, ['push'])
    } else {
      await git(projectRoot, ['push', '-u', 'origin', branch])
    }

    return NextResponse.json({
      ok: true,
      projectId,
      branch,
      commit,
      shortCommit: commit.slice(0, 7),
      marker,
      markerPath,
      committed: true,
      pushed: true,
      message,
    })
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}
