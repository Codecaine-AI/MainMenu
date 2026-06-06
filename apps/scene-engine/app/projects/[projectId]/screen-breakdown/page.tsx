import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadProject as loadSceneProject } from '@/lib/scenes'
import { loadProject as loadExtractionProject } from '@/features/asset-extraction/store'
import type { ExtractionProject } from '@/features/asset-extraction/types'
import { CreateScreenForm } from '../helpers/asset-extraction/_components/CreateScreenForm'

export default async function ScreenBreakdownPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const sceneProject = loadSceneProject(projectId)
  if (!sceneProject) notFound()

  const breakdownProject =
    (await loadExtractionProject(projectId)) ??
    ({
      id: projectId,
      name: sceneProject.name ?? projectId,
      screens: [],
      createdAt: '',
      updatedAt: '',
    } satisfies ExtractionProject)

  const projectBase = `/projects/${encodeURIComponent(projectId)}`

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Stage 01</p>
          <h1 className="page-title">Screen Breakdown</h1>
          <p className="page-subtitle">
            Split still references for {sceneProject.name ?? projectId} into isolated visual candidates.
          </p>
        </div>
        <div className="button-row">
          <Link className="button subtle" href={projectBase}>
            Project
          </Link>
          <Link className="button subtle" href={`${projectBase}/asset-workbench`}>
            Asset Workbench
          </Link>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="surface">
          <div className="surface-header">
            <div>
              <h2 className="surface-title">Reference Screens</h2>
              <p className="surface-note">Each source screen owns one decomposition tree.</p>
            </div>
            <span className="pill">{breakdownProject.screens.length} screens</span>
          </div>
          {breakdownProject.screens.length === 0 ? (
            <div className="empty">
              <p>No screen breakdowns exist for this project yet.</p>
              <p>Add a source screen to start pulling out candidate assets.</p>
            </div>
          ) : (
            <div className="list">
              {breakdownProject.screens.map((screen) => (
                <Link
                  className="list-item screen-list-item"
                  href={`${projectBase}/screen-breakdown/screens/${screen.id}`}
                  key={screen.id}
                >
                  <div className="screen-row-main">
                    <div>
                      <p className="surface-title">{screen.name}</p>
                      <p className="meta">{screen.id}</p>
                    </div>
                  </div>
                  <div className="screen-thumb">
                    <img
                      src={screenThumbnailUrl(projectId, screen.id, screen.updatedAt)}
                      alt={screen.name}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="project-side-stack">
          <section className="surface">
            <div className="surface-header">
              <div>
                <h2 className="surface-title">Add Reference</h2>
                <p className="surface-note">Use a full screenshot or still frame from the current project.</p>
              </div>
            </div>
            <CreateScreenForm projectId={projectId} />
          </section>
        </aside>
      </div>
    </main>
  )
}

function screenThumbnailUrl(projectId: string, screenId: string, version: string) {
  return `/api/projects/${projectId}/helpers/asset-extraction/screens/${screenId}/nodes/root/image?v=${encodeURIComponent(version)}`
}
