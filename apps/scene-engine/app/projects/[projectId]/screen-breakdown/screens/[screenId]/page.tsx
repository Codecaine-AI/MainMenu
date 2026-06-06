import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadWorkspace } from '@/features/asset-extraction/store'
import { ScreenWorkspace } from '../../../helpers/asset-extraction/_components/ScreenWorkspace'

export default async function ScreenBreakdownWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string; screenId: string }>
}) {
  const { projectId, screenId } = await params
  const workspace = await loadWorkspace(projectId, screenId)
  if (!workspace) notFound()

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Screen Breakdown</p>
          <h1 className="page-title">{workspace.screen.name}</h1>
          <p className="page-subtitle">
            Split the source screen into target and residual branches until the leaves are atomic.
          </p>
        </div>
        <div className="button-row">
          <Link className="button subtle" href={`/projects/${projectId}/screen-breakdown`}>
            Screen Breakdown
          </Link>
          <Link className="button subtle" href={`/projects/${projectId}/asset-workbench`}>
            Asset Workbench
          </Link>
        </div>
      </header>
      <ScreenWorkspace initialData={workspace} />
    </main>
  )
}
