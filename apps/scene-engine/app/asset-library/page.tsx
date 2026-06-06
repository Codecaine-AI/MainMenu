import { notFound, redirect } from 'next/navigation'
import { defaultProjectId } from '@/lib/scenes'

export default async function AssetLibraryRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; type?: string }>
}) {
  const params = await searchParams
  const projectId = params.project?.trim() || defaultProjectId()
  if (!projectId) notFound()

  const query = new URLSearchParams()
  if (params.type) query.set('type', params.type)
  const suffix = query.size > 0 ? `?${query.toString()}` : ''

  redirect(`/projects/${encodeURIComponent(projectId)}/assets${suffix}`)
}
