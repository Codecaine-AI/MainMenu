import { notFound, redirect } from 'next/navigation'
import { defaultProjectId } from '@/lib/scenes'

export default async function UploadRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const params = await searchParams
  const projectId = params.project?.trim() || defaultProjectId()
  if (!projectId) notFound()

  redirect(`/projects/${encodeURIComponent(projectId)}/assets/upload`)
}
