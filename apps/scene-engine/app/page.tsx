import Link from 'next/link'
import { discoverProjectsWithDiagnostics } from '@/lib/scenes'

export default function DashboardPage() {
  const { projects, diagnostics } = discoverProjectsWithDiagnostics()

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 border-b border-[#2a2a2a] pb-5">
          <h1 className="text-2xl font-semibold tracking-wide text-gray-100">
            Projects
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Open a project to work with scenes, assets, and helper tools.
          </p>
        </header>

        {diagnostics.length > 0 && (
          <div className="mb-4 border-y border-[#3a2f1f] py-3 text-xs text-amber-300">
            {diagnostics.map((item) => (
              <p key={`${item.code}-${item.projectId ?? item.message}`} className="m-0 py-0.5">
                <span className="font-mono uppercase text-amber-500">{item.level}</span> {item.message}
              </p>
            ))}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="border-y border-[#242424] py-6 text-sm text-gray-500">
            No projects found.
          </div>
        ) : (
          <div className="divide-y divide-[#242424] border-y border-[#242424]">
            {projects.map((project) => (
              <div
                key={project.id}
                className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 truncate text-sm font-medium text-gray-100">
                      {project.name}
                    </p>
                    <span className="rounded-sm border border-[#2a6da3] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#8fc6f2]">
                      Catalog
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-gray-600">
                    {project.id} / entry {project.entry}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/scenes/${encodeURIComponent(project.entry)}?project=${encodeURIComponent(project.id)}&returnTo=${encodeURIComponent('/')}`}
                    className="rounded-sm border border-[#333] bg-[#222] px-2.5 py-1 text-xs text-gray-200 no-underline hover:bg-[#2b2b2b] active:translate-y-px"
                  >
                    Preview
                  </Link>
                  <Link
                    href={`/projects/${encodeURIComponent(project.id)}`}
                    className="rounded-sm border border-[#2a6da3] bg-[#173247] px-2.5 py-1 text-xs text-[#cfe6ff] no-underline hover:bg-[#1d3d54] active:translate-y-px"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
