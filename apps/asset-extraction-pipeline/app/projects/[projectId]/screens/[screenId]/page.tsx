import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ScreenWorkspace } from '../../../../_components/screen-workspace'
import { loadWorkspace } from '../../../../_lib/store'

export default async function ScreenPage({
  params,
}: {
  params: { projectId: string; screenId: string }
}) {
  const { projectId, screenId } = params
  const workspace = await loadWorkspace(projectId, screenId)
  if (!workspace) notFound()

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Screen Workspace</p>
          <h1 className="page-title">{workspace.screen.name}</h1>
          <p className="page-subtitle">
            Split the source screen into target and residual branches until the leaves are atomic.
          </p>
        </div>
        <div className="button-row">
          <Link className="button subtle" href={`/projects/${workspace.project.id}`}>
            Screens
          </Link>
          <Link className="button subtle" href="/">
            Projects
          </Link>
        </div>
      </header>
      <ScreenWorkspace initialData={workspace} />
    </main>
  )
}
