import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const standaloneDir = path.join(projectRoot, '.next/standalone')
const staticDir = path.join(projectRoot, '.next/static')
const outputRoot = path.join(projectRoot, 'desktop/dist-next')
const runtimeDir = path.join(outputRoot, 'runtime')
const seedDir = path.join(outputRoot, 'seed')

async function assertDirectory(dir, message) {
  const stat = await fs.stat(dir).catch(() => null)
  if (!stat?.isDirectory()) {
    throw new Error(message)
  }
}

async function copyDirectory(source, target) {
  await assertDirectory(source, `Missing required directory: ${source}`)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.cp(source, target, { recursive: true })
}

await assertDirectory(standaloneDir, 'Next standalone output is missing. Run `next build` with output: standalone first.')
await assertDirectory(staticDir, 'Next static output is missing. Run `next build` first.')

await fs.rm(outputRoot, { recursive: true, force: true })
await copyDirectory(standaloneDir, runtimeDir)
await fs.rm(path.join(runtimeDir, 'public'), { recursive: true, force: true })
await fs.rm(path.join(runtimeDir, 'projects'), { recursive: true, force: true })
await copyDirectory(staticDir, path.join(runtimeDir, '.next/static'))
await fs.mkdir(seedDir, { recursive: true })
await fs.copyFile(
  path.join(projectRoot, 'workspace.catalog.example.json'),
  path.join(seedDir, 'workspace.catalog.example.json'),
)

const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8'))
await fs.writeFile(
  path.join(outputRoot, 'manifest.json'),
  JSON.stringify(
    {
      productName: packageJson.productName,
      version: packageJson.version,
      generatedAt: new Date().toISOString(),
      runtime: 'Next standalone server',
      writableSeedDirectories: [],
      workspaceCatalog: 'workspace/workspace.catalog.json',
    },
    null,
    2,
  ) + '\n',
  'utf-8',
)

console.log(`Prepared desktop Next runtime at ${path.relative(projectRoot, outputRoot)}`)
