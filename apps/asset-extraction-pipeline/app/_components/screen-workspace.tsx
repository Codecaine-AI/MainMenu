'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type {
  CatalogSuggestion,
  ExtractionNode,
  ExtractionSplit,
  ScreenWorkspaceData,
} from '@/_lib/types'

interface ScreenWorkspaceProps {
  initialData: ScreenWorkspaceData
}

export function ScreenWorkspace({ initialData }: ScreenWorkspaceProps) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [selectedNodeId, setSelectedNodeId] = useState(initialData.screen.rootNodeId)
  const [instruction, setInstruction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [isRefreshing, startTransition] = useTransition()

  const nodesById = useMemo(() => {
    return new Map(data.nodes.map((node) => [node.id, node]))
  }, [data.nodes])

  const splitsByParent = useMemo(() => {
    const grouped = new Map<string, ExtractionSplit[]>()
    for (const split of data.splits) {
      const current = grouped.get(split.parentNodeId) ?? []
      current.push(split)
      grouped.set(split.parentNodeId, current)
    }
    return grouped
  }, [data.splits])

  const selectedNode = nodesById.get(selectedNodeId) ?? nodesById.get(data.screen.rootNodeId)

  async function submitSplit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedNode || !instruction.trim()) return

    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/projects/${data.project.id}/screens/${data.screen.id}/splits`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            parentNodeId: selectedNode.id,
            instruction,
          }),
        },
      )
      const payload = (await response.json()) as ScreenWorkspaceData & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Split creation failed.')
      }
      setData(payload)
      const newestSplit = payload.splits[payload.splits.length - 1]
      setSelectedNodeId(newestSplit?.targetNodeId ?? selectedNode.id)
      setInstruction('')
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Split creation failed.')
    } finally {
      setPending(false)
    }
  }

  async function setFinal(final: boolean) {
    if (!selectedNode) return

    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/projects/${data.project.id}/screens/${data.screen.id}/nodes/${selectedNode.id}/finalize`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ final }),
        },
      )
      const payload = (await response.json()) as ExtractionNode & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Node update failed.')
      }
      setData((current) => ({
        ...current,
        nodes: current.nodes.map((node) => (node.id === payload.id ? payload : node)),
      }))
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Node update failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="workspace-grid">
      <section className="surface canvas-panel">
        <div className="surface-header">
          <div>
            <h2 className="surface-title">Decomposition Tree</h2>
            <p className="surface-note">
              Split any selected node into a target and residual. Model execution is recorded as
              pending output until the image worker is wired in.
            </p>
          </div>
          <span className="pill">{data.nodes.length} nodes</span>
        </div>
        <div className="canvas-scroll">
          <div className="tree">
            <NodeTree
              node={nodesById.get(data.screen.rootNodeId)}
              screenId={data.screen.id}
              projectId={data.project.id}
              nodesById={nodesById}
              splitsByParent={splitsByParent}
              selectedNodeId={selectedNodeId}
              onSelect={setSelectedNodeId}
            />
          </div>
        </div>
      </section>

      <aside className="surface inspector">
        <div className="inspector-section">
          <p className="eyebrow">{data.project.name}</p>
          <h2 className="page-title">{data.screen.name}</h2>
          <p className="page-subtitle">
            Author the extraction tree with text-directed split operations.
          </p>
        </div>

        {selectedNode ? (
          <div className="inspector-section">
            <div className="node-title-row">
              <div>
                <h3 className="surface-title">{selectedNode.label}</h3>
                <p className="surface-note">
                  {selectedNode.kind} node · depth {selectedNode.depth}
                </p>
              </div>
              <StatusPill node={selectedNode} />
            </div>
            <div className="selected-preview">
              <img
                src={nodeImageUrl(data.project.id, data.screen.id, selectedNode.id)}
                alt={selectedNode.label}
              />
            </div>
          </div>
        ) : null}

        <div className="inspector-section">
          <form className="field" onSubmit={submitSplit}>
            <label className="label" htmlFor="split-instruction">
              Split instruction
            </label>
            <textarea
              id="split-instruction"
              className="textarea"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="extract the yellow menu button group"
            />
            <p className="help">
              Each split creates two child nodes: the requested target and the residual image with
              that target removed.
            </p>
            {error ? <p className="error">{error}</p> : null}
            <div className="button-row">
              <button
                className="button primary"
                type="submit"
                disabled={pending || isRefreshing || !selectedNode || !instruction.trim()}
              >
                {pending ? 'Writing...' : 'Create Split'}
              </button>
              {selectedNode?.status === 'final' ? (
                <button
                  className="button subtle"
                  type="button"
                  disabled={pending}
                  onClick={() => void setFinal(false)}
                >
                  Reopen Node
                </button>
              ) : (
                <button
                  className="button subtle"
                  type="button"
                  disabled={pending || !selectedNode}
                  onClick={() => void setFinal(true)}
                >
                  Mark Final
                </button>
              )}
            </div>
          </form>
        </div>

        <CatalogSuggestions
          suggestions={data.screen.catalogSuggestions}
          onUse={(value) => setInstruction(value)}
        />
      </aside>
    </div>
  )
}

function NodeTree({
  node,
  projectId,
  screenId,
  nodesById,
  splitsByParent,
  selectedNodeId,
  onSelect,
}: {
  node: ExtractionNode | undefined
  projectId: string
  screenId: string
  nodesById: Map<string, ExtractionNode>
  splitsByParent: Map<string, ExtractionSplit[]>
  selectedNodeId: string
  onSelect: (nodeId: string) => void
}) {
  if (!node) {
    return (
      <div className="empty">
        <p>Missing root node.</p>
      </div>
    )
  }

  const splits = splitsByParent.get(node.id) ?? []

  return (
    <div className="node-stack">
      <NodeCard
        node={node}
        projectId={projectId}
        screenId={screenId}
        selected={node.id === selectedNodeId}
        onSelect={onSelect}
      />
      {splits.map((split) => {
        const target = nodesById.get(split.targetNodeId)
        const residual = nodesById.get(split.residualNodeId)
        return (
          <div className="branch-pair" key={split.id}>
            <NodeTree
              node={target}
              projectId={projectId}
              screenId={screenId}
              nodesById={nodesById}
              splitsByParent={splitsByParent}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
            />
            <NodeTree
              node={residual}
              projectId={projectId}
              screenId={screenId}
              nodesById={nodesById}
              splitsByParent={splitsByParent}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
            />
          </div>
        )
      })}
    </div>
  )
}

function NodeCard({
  node,
  projectId,
  screenId,
  selected,
  onSelect,
}: {
  node: ExtractionNode
  projectId: string
  screenId: string
  selected: boolean
  onSelect: (nodeId: string) => void
}) {
  return (
    <button
      className={`node-card ${selected ? 'selected' : ''}`}
      type="button"
      onClick={() => onSelect(node.id)}
    >
      <div className="node-image-wrap">
        <img className="node-image" src={nodeImageUrl(projectId, screenId, node.id)} alt={node.label} />
      </div>
      <div className="node-body">
        <div className="node-title-row">
          <div>
            <h3 className="node-title">{node.label}</h3>
            <p className="node-detail">
              {node.kind} · depth {node.depth}
            </p>
          </div>
          <StatusPill node={node} />
        </div>
        {node.instruction ? <p className="node-detail">{node.instruction}</p> : null}
      </div>
    </button>
  )
}

function StatusPill({ node }: { node: ExtractionNode }) {
  if (node.status === 'final') {
    return <span className="pill green">final</span>
  }
  if (node.status === 'pending_model') {
    return <span className="pill accent">pending image</span>
  }
  return <span className="pill">active</span>
}

function CatalogSuggestions({
  suggestions,
  onUse,
}: {
  suggestions: CatalogSuggestion[]
  onUse: (instruction: string) => void
}) {
  return (
    <div className="inspector-section">
      <h3 className="surface-title">Catalog Suggestions</h3>
      <p className="surface-note">
        First-pass ideas are helpers only. The user decides the actual split tree.
      </p>
      <div className="suggestions" style={{ marginTop: 14 }}>
        {suggestions.map((suggestion) => (
          <div className="suggestion" key={suggestion.id}>
            <div className="node-title-row">
              <div>
                <p className="node-title">{suggestion.label}</p>
                <p className="node-detail">{suggestion.description}</p>
              </div>
              <button className="button subtle" type="button" onClick={() => onUse(suggestion.instruction)}>
                Use
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function nodeImageUrl(projectId: string, screenId: string, nodeId: string) {
  return `/api/projects/${projectId}/screens/${screenId}/nodes/${nodeId}/image`
}
