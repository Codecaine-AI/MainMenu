'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  ExtractionNode,
  ExtractionSplit,
  ScreenWorkspaceData,
  SplitPromptDraft,
} from '@/features/asset-extraction/types'

interface ScreenWorkspaceProps {
  initialData: ScreenWorkspaceData
}

interface ViewerImage {
  src: string
  label: string
  detail: string
  promptLabel?: string
  prompt?: string
}

interface PromptPanel {
  id: string
  title: string
  detail: string
  kind: 'target' | 'residual'
  prompt: string
}

const GRAPH_NODE_WIDTH = 272
const GRAPH_NODE_HEIGHT = 226
const GRAPH_COLUMN_GAP = 172
const GRAPH_ROW_GAP = 64
const GRAPH_PADDING = 36

export function ScreenWorkspace({ initialData }: ScreenWorkspaceProps) {
  const [data, setData] = useState(initialData)
  const [selectedNodeId, setSelectedNodeId] = useState(initialData.screen.rootNodeId)
  const [instruction, setInstruction] = useState('')
  const [draft, setDraft] = useState<SplitPromptDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [viewerImage, setViewerImage] = useState<ViewerImage | null>(null)

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

  const splitsById = useMemo(() => {
    return new Map(data.splits.map((split) => [split.id, split]))
  }, [data.splits])

  const selectedNode = nodesById.get(selectedNodeId) ?? nodesById.get(data.screen.rootNodeId)

  const graph = useMemo(() => {
    return buildGraphLayout({
      rootNodeId: data.screen.rootNodeId,
      nodesById,
      splitsByParent,
    })
  }, [data.screen.rootNodeId, nodesById, splitsByParent])

  const selectedNodeSplitCount = selectedNode
    ? (splitsByParent.get(selectedNode.id)?.length ?? 0)
    : 0
  const selectedNodeSplit = selectedNode ? splitsByParent.get(selectedNode.id)?.[0] : undefined
  const selectedNodeInputSplit = selectedNode?.splitId
    ? splitsById.get(selectedNode.splitId)
    : undefined
  const selectedNodeHasSplit = selectedNodeSplitCount > 0
  const selectedPromptPanels = selectedNode
    ? promptPanelsForNode(selectedNode, selectedNodeInputSplit, selectedNodeSplit)
    : []
  const draftInvalid = draft
    ? !draft.targetPrompt.trim() || !draft.residualPrompt.trim()
    : false

  useEffect(() => {
    if (!viewerImage) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setViewerImage(null)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [viewerImage])

  function selectNode(nodeId: string) {
    setSelectedNodeId(nodeId)
    setDraft(null)
    setError(null)
  }

  function openNodeImage(node: ExtractionNode) {
    const prompt = node.splitId ? promptForGeneratedNode(node, splitsById.get(node.splitId)) : null
    setViewerImage({
      src: nodeImageUrl(data.project.id, data.screen.id, node.id, node.updatedAt),
      label: node.label,
      detail: `${node.kind} node · depth ${node.depth}`,
      promptLabel: prompt?.title,
      prompt: prompt?.prompt,
    })
  }

  async function submitSplit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draft) {
      await confirmSplit()
      return
    }
    if (!selectedNode || !instruction.trim()) return
    if (selectedNodeHasSplit) {
      setError('This image already has a split. Select its target or residual child to continue.')
      return
    }

    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/projects/${data.project.id}/helpers/asset-extraction/screens/${data.screen.id}/nodes/${selectedNode.id}/split-draft`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            instruction,
          }),
        },
      )
      const payload = (await response.json()) as SplitPromptDraft & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Prompt draft failed.')
      }
      setDraft(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prompt draft failed.')
    } finally {
      setPending(false)
    }
  }

  async function confirmSplit() {
    if (!selectedNode || !draft) return

    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/projects/${data.project.id}/helpers/asset-extraction/screens/${data.screen.id}/splits`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            parentNodeId: selectedNode.id,
            instruction: draft.instruction,
            targetPrompt: draft.targetPrompt,
            residualPrompt: draft.residualPrompt,
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
      setDraft(null)
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
        `/api/projects/${data.project.id}/helpers/asset-extraction/screens/${data.screen.id}/nodes/${selectedNode.id}/finalize`,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Node update failed.')
    } finally {
      setPending(false)
    }
  }

  async function deleteSelectedSplit() {
    if (!selectedNode || !selectedNodeHasSplit) return
    const confirmed = window.confirm(
      'Delete this split and every descendant below its target/residual pair?',
    )
    if (!confirmed) return

    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/projects/${data.project.id}/helpers/asset-extraction/screens/${data.screen.id}/nodes/${selectedNode.id}/split`,
        {
          method: 'DELETE',
        },
      )
      const payload = (await response.json()) as ScreenWorkspaceData & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Split deletion failed.')
      }
      setData(payload)
      setSelectedNodeId(selectedNode.id)
      setInstruction('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Split deletion failed.')
    } finally {
      setPending(false)
    }
  }

  async function generateSelectedSplitImages() {
    if (!selectedNode || !selectedNodeHasSplit) return

    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/projects/${data.project.id}/helpers/asset-extraction/screens/${data.screen.id}/nodes/${selectedNode.id}/split/generate`,
        {
          method: 'POST',
        },
      )
      const payload = (await response.json()) as ScreenWorkspaceData & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Split image generation failed.')
      }
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Split image generation failed.')
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
              Split any selected node into one target/residual pair. Confirmed splits run both
              image edits and attach the generated outputs to the tree.
            </p>
          </div>
          <span className="pill">{graph.nodes.length} nodes</span>
        </div>
        <div className="canvas-scroll">
          <div className="graph-canvas" style={{ width: graph.width, height: graph.height }}>
            <svg
              className="graph-edges"
              width={graph.width}
              height={graph.height}
              viewBox={`0 0 ${graph.width} ${graph.height}`}
              aria-hidden="true"
            >
              {graph.edges.map((edge) => (
                <g key={edge.id}>
                  <path className={`graph-edge ${edge.kind}`} d={edge.path} />
                  <text
                    className={`graph-edge-label ${edge.kind}`}
                    x={edge.labelX}
                    y={edge.labelY}
                    textAnchor="middle"
                  >
                    {edge.kind}
                  </text>
                </g>
              ))}
            </svg>

            {graph.nodes.length === 0 ? (
              <div className="empty">
                <p>Missing root node.</p>
              </div>
            ) : (
              graph.nodes.map((graphNode) => (
                <div
                  className={`graph-node ${graphNode.node.id === selectedNodeId ? 'selected' : ''}`}
                  key={graphNode.node.id}
                  style={{ transform: `translate(${graphNode.x}px, ${graphNode.y}px)` }}
                >
                  <NodeCard
                    node={graphNode.node}
                    projectId={data.project.id}
                    screenId={data.screen.id}
                    selected={graphNode.node.id === selectedNodeId}
                    onSelect={selectNode}
                    onImageOpen={openNodeImage}
                  />
                </div>
              ))
            )}
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
                src={nodeImageUrl(
                  data.project.id,
                  data.screen.id,
                  selectedNode.id,
                  selectedNode.updatedAt,
                )}
                alt={selectedNode.label}
                decoding="async"
              />
            </div>
            {selectedPromptPanels.length > 0 ? (
              <div className="prompt-history">
                <div className="node-title-row">
                  <div>
                    <h3 className="surface-title">Run Prompts</h3>
                    <p className="surface-note">Prompts saved for the selected phase.</p>
                  </div>
                  <span className="pill">{selectedPromptPanels.length} prompts</span>
                </div>
                {selectedPromptPanels.map((panel) => (
                  <div className="prompt-run" key={panel.id}>
                    <div className="prompt-run-heading">
                      <label className="label" htmlFor={`run-prompt-${panel.id}`}>
                        {panel.title}
                      </label>
                      <span className={`pill ${panel.kind === 'target' ? 'accent' : 'green'}`}>
                        {panel.kind}
                      </span>
                    </div>
                    <p className="help">{panel.detail}</p>
                    <textarea
                      id={`run-prompt-${panel.id}`}
                      className="textarea prompt-textarea prompt-run-textarea"
                      value={panel.prompt}
                      readOnly
                    />
                  </div>
                ))}
              </div>
            ) : null}
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
              onChange={(event) => {
                setInstruction(event.target.value)
                setDraft(null)
              }}
              placeholder={
                selectedNodeHasSplit
                  ? 'select an unsplit child node to continue'
                  : 'extract the yellow menu button group'
              }
              disabled={pending || selectedNodeHasSplit}
            />
            {selectedNodeHasSplit ? (
              <p className="help">
                This node already has one target/residual pair. Continue from one of its child nodes.
              </p>
            ) : (
              <p className="help">
                Draft the target and residual prompts first, then confirm when they look right.
              </p>
            )}
            {draft ? (
              <div className="prompt-preview">
                <div className="node-title-row">
                  <div>
                    <h3 className="surface-title">Prompt Draft</h3>
                    <p className="surface-note">
                      Generated by {draft.model}
                    </p>
                  </div>
                  <span className="pill accent">review</span>
                </div>
                <div className="field">
                  <label className="label" htmlFor="target-prompt">
                    Target prompt
                  </label>
                  <textarea
                    id="target-prompt"
                    className="textarea prompt-textarea"
                    value={draft.targetPrompt}
                    disabled={pending}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, targetPrompt: event.target.value } : current,
                      )
                    }
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="residual-prompt">
                    Residual prompt
                  </label>
                  <textarea
                    id="residual-prompt"
                    className="textarea prompt-textarea"
                    value={draft.residualPrompt}
                    disabled={pending}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, residualPrompt: event.target.value } : current,
                      )
                    }
                  />
                </div>
              </div>
            ) : null}
            {error ? <p className="error">{error}</p> : null}
            <div className="button-row">
              <button
                className="button primary"
                type="submit"
                disabled={
                  pending ||
                  selectedNodeHasSplit ||
                  !selectedNode ||
                  !instruction.trim() ||
                  draftInvalid
                }
              >
                {pending ? 'Working...' : draft ? 'Confirm Split' : 'Draft Prompts'}
              </button>
              {draft ? (
                <button
                  className="button subtle"
                  type="button"
                  disabled={pending}
                  onClick={() => setDraft(null)}
                >
                  Discard Draft
                </button>
              ) : null}
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
              {selectedNodeHasSplit ? (
                <>
                  {selectedNodeSplit?.status === 'pending_model' ||
                  selectedNodeSplit?.status === 'failed' ? (
                    <button
                      className="button primary"
                      type="button"
                      disabled={pending || !selectedNode}
                      onClick={() => void generateSelectedSplitImages()}
                    >
                      Generate Images
                    </button>
                  ) : null}
                  <button
                    className="button danger"
                    type="button"
                    disabled={pending || !selectedNode}
                    onClick={() => void deleteSelectedSplit()}
                  >
                    Delete Split
                  </button>
                </>
              ) : null}
            </div>
          </form>
        </div>
      </aside>

      {viewerImage ? (
        <ImageViewerModal image={viewerImage} onClose={() => setViewerImage(null)} />
      ) : null}
    </div>
  )
}

interface GraphLayoutInput {
  rootNodeId: string
  nodesById: Map<string, ExtractionNode>
  splitsByParent: Map<string, ExtractionSplit[]>
}

interface GraphLayoutNode {
  node: ExtractionNode
  x: number
  y: number
}

interface GraphLayoutEdge {
  id: string
  kind: 'target' | 'residual'
  path: string
  labelX: number
  labelY: number
}

function buildGraphLayout({ rootNodeId, nodesById, splitsByParent }: GraphLayoutInput) {
  const root = nodesById.get(rootNodeId)
  if (!root) {
    return { nodes: [], edges: [], width: 640, height: 420 }
  }

  const leafCounts = new Map<string, number>()
  const measured = new Set<string>()

  function getChildren(nodeId: string) {
    const splits = splitsByParent.get(nodeId) ?? []
    const split = splits[0]
    if (!split) return []

    return [
      { nodeId: split.targetNodeId, splitId: split.id, kind: 'target' as const },
      { nodeId: split.residualNodeId, splitId: split.id, kind: 'residual' as const },
    ]
  }

  function measure(nodeId: string): number {
    if (measured.has(nodeId)) return 1
    measured.add(nodeId)

    const childCount = getChildren(nodeId).reduce((total, child) => {
      return nodesById.has(child.nodeId) ? total + measure(child.nodeId) : total
    }, 0)
    const count = Math.max(1, childCount)
    leafCounts.set(nodeId, count)
    return count
  }

  const totalLeaves = measure(rootNodeId)
  const graphNodes: GraphLayoutNode[] = []
  const nodePositions = new Map<string, { x: number; y: number }>()
  const placing = new Set<string>()
  let maxDepth = 0

  function place(nodeId: string, depth: number, leafStart: number) {
    const node = nodesById.get(nodeId)
    if (!node || placing.has(nodeId)) return

    placing.add(nodeId)
    const leafCount = leafCounts.get(nodeId) ?? 1
    const x = GRAPH_PADDING + depth * (GRAPH_NODE_WIDTH + GRAPH_COLUMN_GAP)
    const y =
      GRAPH_PADDING +
      leafStart * (GRAPH_NODE_HEIGHT + GRAPH_ROW_GAP) +
      ((leafCount - 1) * (GRAPH_NODE_HEIGHT + GRAPH_ROW_GAP)) / 2

    graphNodes.push({ node, x, y })
    nodePositions.set(nodeId, { x, y })
    maxDepth = Math.max(maxDepth, depth)

    let childLeafStart = leafStart
    for (const child of getChildren(nodeId)) {
      if (!nodesById.has(child.nodeId)) continue
      place(child.nodeId, depth + 1, childLeafStart)
      childLeafStart += leafCounts.get(child.nodeId) ?? 1
    }
    placing.delete(nodeId)
  }

  place(rootNodeId, 0, 0)

  const graphEdges: GraphLayoutEdge[] = []
  for (const parent of graphNodes) {
    for (const child of getChildren(parent.node.id)) {
      const childPosition = nodePositions.get(child.nodeId)
      if (!childPosition) continue
      const fromX = parent.x + GRAPH_NODE_WIDTH
      const fromY = parent.y + GRAPH_NODE_HEIGHT / 2
      const toX = childPosition.x
      const toY = childPosition.y + GRAPH_NODE_HEIGHT / 2
      const curve = Math.max(72, (toX - fromX) * 0.46)

      graphEdges.push({
        id: `${child.splitId}-${child.kind}`,
        kind: child.kind,
        path: `M ${fromX} ${fromY} C ${fromX + curve} ${fromY}, ${toX - curve} ${toY}, ${toX} ${toY}`,
        labelX: fromX + (toX - fromX) / 2,
        labelY: fromY + (toY - fromY) / 2 - 8,
      })
    }
  }

  return {
    nodes: graphNodes,
    edges: graphEdges,
    width:
      GRAPH_PADDING * 2 +
      (maxDepth + 1) * GRAPH_NODE_WIDTH +
      maxDepth * GRAPH_COLUMN_GAP,
    height:
      GRAPH_PADDING * 2 +
      totalLeaves * GRAPH_NODE_HEIGHT +
      Math.max(0, totalLeaves - 1) * GRAPH_ROW_GAP,
  }
}

function NodeCard({
  node,
  projectId,
  screenId,
  selected,
  onSelect,
  onImageOpen,
}: {
  node: ExtractionNode
  projectId: string
  screenId: string
  selected: boolean
  onSelect: (nodeId: string) => void
  onImageOpen: (node: ExtractionNode) => void
}) {
  return (
    <div className={`node-card ${selected ? 'selected' : ''}`}>
      <button
        className="node-image-trigger"
        type="button"
        onClick={() => onImageOpen(node)}
        aria-label={`Open ${node.label} image`}
      >
        <img
          className="node-image"
          src={nodeImageUrl(projectId, screenId, node.id, node.updatedAt)}
          alt={node.label}
          loading="lazy"
          decoding="async"
        />
      </button>
      <button
        className="node-body node-body-trigger"
        type="button"
        onClick={() => onSelect(node.id)}
      >
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
      </button>
    </div>
  )
}

function ImageViewerModal({
  image,
  onClose,
}: {
  image: ViewerImage
  onClose: () => void
}) {
  return (
    <div className="image-modal" role="dialog" aria-modal="true" aria-label={image.label}>
      <button className="image-modal-backdrop" type="button" aria-label="Close image" onClick={onClose} />
      <div className="image-modal-panel">
        <div className="image-modal-header">
          <div>
            <h2 className="surface-title">{image.label}</h2>
            <p className="surface-note">{image.detail}</p>
          </div>
          <button className="button subtle" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="image-modal-frame">
          <img src={image.src} alt={image.label} decoding="async" />
        </div>
        {image.prompt ? (
          <div className="image-modal-prompt">
            <label className="label" htmlFor="image-modal-run-prompt">
              {image.promptLabel ?? 'Run prompt'}
            </label>
            <textarea
              id="image-modal-run-prompt"
              className="textarea prompt-textarea prompt-run-textarea"
              value={image.prompt}
              readOnly
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StatusPill({ node }: { node: ExtractionNode }) {
  if (node.status === 'final') {
    return <span className="pill green">final</span>
  }
  if (node.status === 'generated') {
    return <span className="pill green">generated</span>
  }
  if (node.status === 'failed') {
    return <span className="pill red">failed</span>
  }
  if (node.status === 'pending_model') {
    return <span className="pill accent">pending image</span>
  }
  return <span className="pill">active</span>
}

function nodeImageUrl(projectId: string, screenId: string, nodeId: string, version?: string) {
  const base = `/api/projects/${projectId}/helpers/asset-extraction/screens/${screenId}/nodes/${nodeId}/image`
  return version ? `${base}?v=${encodeURIComponent(version)}` : base
}

function promptForGeneratedNode(
  node: ExtractionNode,
  split: ExtractionSplit | undefined,
): PromptPanel | null {
  if (!split) return null

  if (node.id === split.targetNodeId && split.targetPrompt) {
    return {
      id: `${split.id}-target-input`,
      title: 'Prompt used for this image',
      detail: `Target output from ${split.id}: ${split.instruction}`,
      kind: 'target',
      prompt: split.targetPrompt,
    }
  }

  if (node.id === split.residualNodeId && split.residualPrompt) {
    return {
      id: `${split.id}-residual-input`,
      title: 'Prompt used for this image',
      detail: `Residual output from ${split.id}: ${split.instruction}`,
      kind: 'residual',
      prompt: split.residualPrompt,
    }
  }

  return null
}

function promptPanelsForNode(
  node: ExtractionNode,
  inputSplit: ExtractionSplit | undefined,
  outputSplit: ExtractionSplit | undefined,
): PromptPanel[] {
  const panels: PromptPanel[] = []
  const generatedPrompt = promptForGeneratedNode(node, inputSplit)
  if (generatedPrompt) panels.push(generatedPrompt)

  if (outputSplit?.targetPrompt) {
    panels.push({
      id: `${outputSplit.id}-target-output`,
      title: 'Target prompt from this node',
      detail: `Creates ${outputSplit.targetNodeId}: ${outputSplit.instruction}`,
      kind: 'target',
      prompt: outputSplit.targetPrompt,
    })
  }

  if (outputSplit?.residualPrompt) {
    panels.push({
      id: `${outputSplit.id}-residual-output`,
      title: 'Residual prompt from this node',
      detail: `Creates ${outputSplit.residualNodeId}: ${outputSplit.instruction}`,
      kind: 'residual',
      prompt: outputSplit.residualPrompt,
    })
  }

  return panels
}
