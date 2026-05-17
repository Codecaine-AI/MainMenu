import Link from 'next/link'
import { discoverProjects } from '@/lib/scenes'

export default function DashboardPage() {
  const projects = discoverProjects()

  return (
    <div className="min-h-screen bg-[#111] p-8">
      <div className="flex items-center justify-between mb-6 max-w-xl">
        <h1 className="text-lg font-semibold text-gray-300 tracking-wide">
          Scene Engine
        </h1>
        <Link
          href="/upload"
          className="text-xs px-2.5 py-1 rounded-sm bg-[#173247] border border-[#2a6da3] text-[#cfe6ff] hover:bg-[#1d3d54] no-underline"
        >
          Upload Asset
        </Link>
      </div>
      {projects.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No projects found. Create a project under <code className="text-gray-400">projects/&lt;id&gt;/project.json</code>.
        </p>
      ) : (
        <div className="grid gap-3 max-w-xl">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-gray-300 text-sm font-medium">{project.name}</p>
                <p className="text-gray-600 text-xs font-mono mt-0.5">
                  {project.id} &middot; {project.sceneCount} scene{project.sceneCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                {project.isLegacyRoot && (
                  <span className="bg-[#173247] border border-[#2a6da3] text-[#cfe6ff] rounded-sm px-2 py-0.5 text-[10px] tracking-wider uppercase">
                    Legacy
                  </span>
                )}
                <Link
                  href={`/projects/${project.id}`}
                  className="text-xs px-2.5 py-1 rounded-sm bg-[#222] border border-[#333] text-gray-300 hover:bg-[#2a2a2a] no-underline"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
