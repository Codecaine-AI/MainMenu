import Link from 'next/link'
import { CreateProjectForm } from './_components/create-project-form'
import { listProjects } from './_lib/store'

export default async function DashboardPage() {
  const projects = await listProjects()

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Asset Extraction</p>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            A project groups screens. Each screen owns its own decomposition tree.
          </p>
        </div>
      </header>

      <div className="project-list-layout">
        <section className="surface">
          <div className="surface-header">
            <div>
              <h2 className="surface-title">Project List</h2>
              <p className="surface-note">Open a project to manage screens and extraction trees.</p>
            </div>
            <span className="pill">{projects.length} projects</span>
          </div>
          {projects.length === 0 ? (
            <div className="empty">
              <p>No extraction projects exist yet.</p>
              <p>Create one for a game or visual system, then add source screens inside it.</p>
            </div>
          ) : (
            <div className="list">
              {projects.map((project) => (
                <Link className="list-item" href={`/projects/${project.id}`} key={project.id}>
                  <div>
                    <p className="surface-title">{project.name}</p>
                    <p className="meta">
                      {project.id} · {project.screenCount} screen{project.screenCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="pill">Open</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="surface compact-create">
          <div className="surface-header">
            <div>
              <h2 className="surface-title">New Project</h2>
              <p className="surface-note">Use a broad source name like Melee.</p>
            </div>
          </div>
          <CreateProjectForm />
        </section>
      </div>
    </main>
  )
}
