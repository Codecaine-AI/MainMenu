import { ProjectMenuCommands } from './_components/ProjectMenuCommands'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  return (
    <>
      <ProjectMenuCommands projectId={projectId} />
      {children}
    </>
  )
}
