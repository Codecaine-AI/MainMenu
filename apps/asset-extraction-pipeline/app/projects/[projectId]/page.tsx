import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CreateScreenForm } from '../../_components/create-screen-form'
import { loadProject } from '../../_lib/store'

export default async function ProjectPage({
  params,
}: {
  params: { projectId: string }
}) {
  const { projectId } = params
  const project = await loadProject(projectId)
  if (!project) notFound()

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Project</p>
          <h1 className="page-title">{project.name}</h1>
          <p className="page-subtitle">
            Add source screens, then open a screen workspace to build its extraction tree.
          </p>
        </div>
        <Link className="button subtle" href="/">
          Projects
        </Link>
      </header>

      <div className="dashboard-grid">
        <section className="surface">
          <div className="surface-header">
            <div>
              <h2 className="surface-title">Screens</h2>
              <p className="surface-note">Each screen has one source image and one split tree.</p>
            </div>
            <span className="pill">{project.screens.length} screens</span>
          </div>
          {project.screens.length === 0 ? (
            <div className="empty">
              <p>No screens have been added to this project.</p>
              <p>Upload a source image to start the first decomposition tree.</p>
            </div>
          ) : (
            <div className="list">
              {project.screens.map((screen) => (
                <Link
                  className="list-item"
                  href={`/projects/${project.id}/screens/${screen.id}`}
                  key={screen.id}
                >
                  <div>
                    <p className="surface-title">{screen.name}</p>
                    <p className="meta">{screen.id}</p>
                  </div>
                  <span className="pill">Open</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="surface">
          <div className="surface-header">
            <div>
              <h2 className="surface-title">Add Screen</h2>
              <p className="surface-note">Use names like Title Screen or Main Menu 1.</p>
            </div>
          </div>
          <CreateScreenForm projectId={project.id} />
        </aside>
      </div>
    </main>
  )
}
