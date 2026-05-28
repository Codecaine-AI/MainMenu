import { projectFileResponse } from '@/lib/project-file-serving'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; path: string[] }> },
) {
  const { projectId, path } = await params
  return projectFileResponse(projectId, 'fonts', path)
}
