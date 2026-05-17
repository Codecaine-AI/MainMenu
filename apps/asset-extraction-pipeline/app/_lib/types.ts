export type NodeKind = 'source' | 'target' | 'residual'
export type NodeStatus = 'active' | 'pending_model' | 'final'
export type SplitStatus = 'pending_model' | 'generated' | 'approved'

export interface ProjectScreenRef {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ExtractionProject {
  id: string
  name: string
  screens: ProjectScreenRef[]
  createdAt: string
  updatedAt: string
}

export interface CatalogSuggestion {
  id: string
  label: string
  description: string
  instruction: string
}

export interface ExtractionScreen {
  id: string
  projectId: string
  name: string
  sourceImage: string
  rootNodeId: string
  nodeOrder: string[]
  splitOrder: string[]
  catalogSuggestions: CatalogSuggestion[]
  createdAt: string
  updatedAt: string
}

export interface ExtractionNode {
  id: string
  projectId: string
  screenId: string
  parentId: string | null
  splitId: string | null
  kind: NodeKind
  label: string
  imagePath: string
  depth: number
  status: NodeStatus
  instruction: string | null
  createdAt: string
  updatedAt: string
}

export interface ExtractionSplit {
  id: string
  projectId: string
  screenId: string
  parentNodeId: string
  instruction: string
  targetNodeId: string
  residualNodeId: string
  status: SplitStatus
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  screenCount: number
  updatedAt: string
}

export interface ScreenWorkspaceData {
  project: ExtractionProject
  screen: ExtractionScreen
  nodes: ExtractionNode[]
  splits: ExtractionSplit[]
}
