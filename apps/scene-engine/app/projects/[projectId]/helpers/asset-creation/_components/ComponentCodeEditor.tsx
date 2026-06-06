'use client'

import { useMemo, useState } from 'react'
import type { AssetCreationRecord } from '@/features/asset-creation/types'

interface Props {
  initialRecord: AssetCreationRecord
  sourceUrl: string
  renderUrl: string | null
}

export function ComponentCodeEditor({ initialRecord, sourceUrl, renderUrl }: Props) {
  const [record, setRecord] = useState(initialRecord)
  const [componentHtml, setComponentHtml] = useState(initialRecord.componentHtml)
  const [componentCss, setComponentCss] = useState(initialRecord.componentCss)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const preview = useMemo(() => {
    const html = componentHtml.split('__SOURCE_IMAGE__').join(sourceUrl)
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      background: transparent;
    }

    body {
      display: grid;
      place-items: center;
      padding: 24px;
      color: #e5e7eb;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    ${componentCss}
  </style>
</head>
<body>
${html}
</body>
</html>`
  }, [componentCss, componentHtml, sourceUrl])

  async function save() {
    setPending(true)
    setError(null)
    setMessage('')
    try {
      const response = await fetch(
        `/api/projects/${record.projectId}/helpers/asset-creation/assets/${record.id}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ componentHtml, componentCss }),
        },
      )
      const payload = (await response.json()) as AssetCreationRecord & { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Save failed.')
      setRecord(payload)
      setMessage('Saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setPending(false)
    }
  }

  async function promote() {
    setPending(true)
    setError(null)
    setMessage('')
    try {
      const response = await fetch(
        `/api/projects/${record.projectId}/helpers/asset-creation/assets/${record.id}/promote`,
        { method: 'POST' },
      )
      const payload = (await response.json()) as { id?: string; record?: AssetCreationRecord; error?: string }
      if (!response.ok || !payload.id || !payload.record) {
        throw new Error(payload.error ?? 'Promotion failed.')
      }
      setRecord(payload.record)
      setMessage(`Promoted as ${payload.id}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promotion failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)]">
      <section className="grid min-h-[calc(100dvh-190px)] grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-gray-400">Asset Source</h2>
            <p className="mt-1 font-mono text-xs text-gray-600">{record.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={pending}
              className="rounded-sm border border-[#2a6da3] bg-[#173247] px-3 py-1.5 text-xs text-[#cfe6ff] hover:bg-[#1d3d54] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => void promote()}
              disabled={pending}
              className="rounded-sm border border-[#444] bg-[#202020] px-3 py-1.5 text-xs text-gray-200 hover:bg-[#2a2a2a] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              Publish Asset
            </button>
          </div>
        </div>

        <label className="grid min-h-0 gap-1.5 text-xs text-gray-500">
          HTML / SVG
          <textarea
            value={componentHtml}
            onChange={(event) => setComponentHtml(event.target.value)}
            spellCheck={false}
            className="min-h-0 resize-none rounded-sm border border-[#333] bg-[#161616] p-3 font-mono text-xs leading-5 text-gray-200 outline-none focus:border-[#5d7790]"
          />
        </label>

        <label className="grid min-h-0 gap-1.5 text-xs text-gray-500">
          CSS
          <textarea
            value={componentCss}
            onChange={(event) => setComponentCss(event.target.value)}
            spellCheck={false}
            className="min-h-0 resize-none rounded-sm border border-[#333] bg-[#161616] p-3 font-mono text-xs leading-5 text-gray-200 outline-none focus:border-[#5d7790]"
          />
        </label>
      </section>

      <aside className="grid content-start gap-4">
        <section className="border-y border-[#242424] py-4">
          <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-gray-400">Reference</h2>
          <div className="mt-3 grid min-h-48 place-items-center bg-[#101010] p-3">
            <img src={sourceUrl} alt="" className="max-h-72 max-w-full object-contain" />
          </div>
        </section>

        <section className="border-y border-[#242424] py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-gray-400">Preview</h2>
            {record.promotedAssetId ? (
              <span className="font-mono text-[11px] text-emerald-400">{record.promotedAssetId}</span>
            ) : null}
          </div>
          <iframe
            title={`${record.name} preview`}
            srcDoc={preview}
            className="mt-3 h-72 w-full rounded-sm border border-[#333] bg-[#101010]"
          />
        </section>

        {renderUrl ? (
          <section className="border-y border-[#242424] py-4">
            <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-gray-400">Loop Render</h2>
            <div className="mt-3 grid min-h-40 place-items-center bg-[#101010] p-3">
              <img src={renderUrl} alt="" className="max-h-56 max-w-full object-contain" />
            </div>
          </section>
        ) : null}

        <div className="min-h-4 text-xs">
          {error ? <span className="text-red-400">{error}</span> : <span className="text-emerald-400">{message}</span>}
        </div>
      </aside>
    </div>
  )
}
