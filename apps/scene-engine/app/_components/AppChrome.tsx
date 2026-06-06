'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ProjectManifest } from '@/types/scene'

interface Props {
  children: ReactNode
}

interface NavItem {
  href: string
  label: string
  exact?: boolean
}

const SEGMENT_LABELS: Record<string, string> = {
  assets: 'Assets',
  upload: 'Upload',
  settings: 'Settings',
  'screen-breakdown': 'Screen Breakdown',
  'asset-workbench': 'Asset Workbench',
  'asset-extraction': 'Screen Breakdown',
  'asset-creation': 'Asset Workbench',
  'component-workbench': 'Component Workbench',
}

const DEFAULT_APP_TITLE = 'Main Menu'

function projectAssetUrl(projectId: string, logicalPath: string | undefined) {
  if (!logicalPath?.startsWith('/assets/')) return null
  return `/api/projects/${encodeURIComponent(projectId)}${logicalPath}`
}

function ensureLiveFavicon() {
  const existing = document.head.querySelector<HTMLLinkElement>('link[data-project-favicon="true"]')
  if (existing) return existing

  const link = document.createElement('link')
  link.rel = 'icon'
  link.dataset.projectFavicon = 'true'
  document.head.appendChild(link)
  return link
}

function removeLiveFavicon() {
  document.head.querySelector<HTMLLinkElement>('link[data-project-favicon="true"]')?.remove()
}

function applyProjectChrome(projectId: string, project: ProjectManifest | null) {
  const title = project?.web?.title?.trim() || project?.name || DEFAULT_APP_TITLE
  document.title = title

  const favicon = projectAssetUrl(projectId, project?.web?.favicon)
  if (favicon) {
    ensureLiveFavicon().href = favicon
  } else {
    removeLiveFavicon()
  }
}

function titleCaseSegment(segment: string) {
  const decoded = decodeURIComponent(segment)
  if (SEGMENT_LABELS[decoded]) return SEGMENT_LABELS[decoded]
  return decoded
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function projectIdFromPath(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function projectIdFromSearch(searchParams: { get: (key: string) => string | null }) {
  const value = searchParams.get('project')
  return value?.trim() || null
}

function buildCrumbs(pathname: string, projectId: string | null) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return ['Workspace']
  if (projectId) {
    const tail = parts.slice(2).map(titleCaseSegment)
    return ['Workspace', titleCaseSegment(projectId), ...tail]
  }
  return ['Workspace', ...parts.map(titleCaseSegment)]
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item)
  return (
    <Link className={active ? 'unity-nav-link active' : 'unity-nav-link'} href={item.href}>
      {item.label}
    </Link>
  )
}

function useProjectChrome(projectId: string | null) {
  const [project, setProject] = useState<ProjectManifest | null>(null)

  useEffect(() => {
    if (!projectId) {
      setProject(null)
      document.title = DEFAULT_APP_TITLE
      removeLiveFavicon()
      return
    }

    let cancelled = false
    fetch(`/api/projects/${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ProjectManifest | null) => {
        if (cancelled) return
        setProject(json)
        applyProjectChrome(projectId, json)
      })
      .catch(() => {
        if (cancelled) return
        setProject(null)
        document.title = DEFAULT_APP_TITLE
        removeLiveFavicon()
      })

    function handleProjectSettingsSaved(event: Event) {
      const detail = (event as CustomEvent<{ projectId?: string; project?: ProjectManifest }>).detail
      if (detail?.projectId !== projectId) return
      const nextProject = detail.project ?? null
      setProject(nextProject)
      applyProjectChrome(projectId, nextProject)
    }

    window.addEventListener('scene-engine:project-settings-saved', handleProjectSettingsSaved)

    return () => {
      cancelled = true
      window.removeEventListener('scene-engine:project-settings-saved', handleProjectSettingsSaved)
    }
  }, [projectId])

  return project
}

export function AppChrome({ children }: Props) {
  const pathname = usePathname() ?? '/'
  const searchParams = useSearchParams()
  const isFullscreenSurface = pathname.startsWith('/editor') || pathname.startsWith('/scenes')
  const projectId = projectIdFromPath(pathname)
  const activeProjectId = projectId ?? projectIdFromSearch(searchParams)
  const project = useProjectChrome(activeProjectId)
  const projectFavicon = useMemo(
    () => (projectId ? projectAssetUrl(projectId, project?.web?.favicon) : null),
    [project?.web?.favicon, projectId],
  )
  if (isFullscreenSurface) return <>{children}</>

  const projectBase = projectId ? `/projects/${encodeURIComponent(projectId)}` : null
  const workspaceItems: NavItem[] = [
    { href: '/', label: 'Projects', exact: true },
  ]
  const projectItems: NavItem[] = projectBase
    ? [
        { href: projectBase, label: 'Overview', exact: true },
        { href: `${projectBase}/settings`, label: 'Settings' },
        { href: `${projectBase}/screen-breakdown`, label: 'Screen Breakdown' },
        { href: `${projectBase}/asset-workbench`, label: 'Asset Workbench' },
        { href: `${projectBase}/component-workbench`, label: 'Component Workbench' },
        { href: `${projectBase}/assets`, label: 'Assets', exact: true },
      ]
    : []
  const crumbs = buildCrumbs(pathname, projectId)

  return (
    <div className="unity-app-shell">
      <aside className="unity-sidebar" aria-label="Application navigation">
        <div className="unity-brand">
          <span className="unity-brand-kicker">Scene Engine</span>
          <span className="unity-brand-title">Main Menu</span>
        </div>

        <nav className="unity-nav">
          <div className="unity-nav-group">
            <p className="unity-nav-heading">Workspace</p>
            {workspaceItems.map((item) => (
              <NavLink item={item} key={item.href} pathname={pathname} />
            ))}
          </div>

          {projectId && (
            <div className="unity-nav-group">
              <p className="unity-nav-heading">Project</p>
              <div className="unity-current-project-row" title={project?.name ?? projectId}>
                <span className="unity-current-project-icon" aria-hidden="true">
                  {projectFavicon ? <img alt="" src={projectFavicon} /> : null}
                </span>
                <p className="unity-current-project">
                  {project?.name ?? titleCaseSegment(projectId)}
                </p>
              </div>
              {projectItems.map((item) => (
                <NavLink item={item} key={item.href} pathname={pathname} />
              ))}
            </div>
          )}
        </nav>
      </aside>

      <header className="unity-titlebar">
        <div className="unity-crumbs" aria-label="Current location">
          {crumbs.map((crumb, index) => (
            <span className="unity-crumb" key={`${crumb}-${index}`}>
              {crumb}
            </span>
          ))}
        </div>
      </header>

      <div className="unity-app-main">{children}</div>
    </div>
  )
}
