import { useState } from 'react'
import {
  diagramToSvg,
  type CleanupMode,
  type CleanupResponse,
} from '../lib/cleanup'
import { downloadBlob } from '../lib/export'

interface AiPanelProps {
  hasStrokes: boolean
  /** Renders the current sketch as a PNG data URL (white background). */
  getSketchPng: () => Promise<string>
}

type PanelState =
  | { kind: 'idle' }
  | { kind: 'loading'; mode: CleanupMode }
  | { kind: 'diagram'; svg: string }
  | { kind: 'ui'; html: string; copied: boolean }
  | { kind: 'error'; message: string }

export function AiPanel({ hasStrokes, getSketchPng }: AiPanelProps) {
  const [state, setState] = useState<PanelState>({ kind: 'idle' })
  const busy = state.kind === 'loading'

  async function run(mode: CleanupMode) {
    setState({ kind: 'loading', mode })
    try {
      const image = await getSketchPng()
      const resp = await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, image }),
      })
      const data = (await resp.json()) as CleanupResponse
      if (!data.ok) {
        setState({ kind: 'error', message: data.error })
      } else if (data.mode === 'diagram') {
        setState({ kind: 'diagram', svg: diagramToSvg(data.diagram) })
      } else {
        setState({ kind: 'ui', html: data.html, copied: false })
      }
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Unbekannter Fehler',
      })
    }
  }

  async function copyHtml() {
    if (state.kind !== 'ui') return
    await navigator.clipboard.writeText(state.html)
    setState({ ...state, copied: true })
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex gap-3">
        <button
          onClick={() => run('diagram')}
          disabled={!hasStrokes || busy}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-40"
        >
          {busy && state.mode === 'diagram' ? 'KI arbeitet…' : '✨ Diagramm aufräumen'}
        </button>
        <button
          onClick={() => run('ui')}
          disabled={!hasStrokes || busy}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-40"
        >
          {busy && state.mode === 'ui' ? 'KI arbeitet…' : '✨ UI-Code generieren'}
        </button>
      </div>

      {state.kind === 'error' && (
        <p className="max-w-xl text-center text-sm text-red-400">{state.message}</p>
      )}

      {state.kind === 'diagram' && (
        <div className="flex w-full flex-col items-center gap-3">
          <div
            className="w-full overflow-hidden rounded-xl bg-zinc-50 [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: state.svg }}
          />
          <button
            onClick={() =>
              downloadBlob(
                new Blob([state.svg], { type: 'image/svg+xml' }),
                'aircanvas-diagramm.svg',
              )
            }
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Diagramm als SVG ↓
          </button>
        </div>
      )}

      {state.kind === 'ui' && (
        <div className="flex w-full flex-col items-center gap-3">
          <iframe
            sandbox=""
            srcDoc={state.html}
            title="Generierte UI-Vorschau"
            className="h-96 w-full rounded-xl border border-zinc-700 bg-white"
          />
          <div className="flex gap-3">
            <button
              onClick={copyHtml}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              {state.copied ? 'Kopiert ✓' : 'HTML kopieren'}
            </button>
            <button
              onClick={() =>
                downloadBlob(new Blob([state.html], { type: 'text/html' }), 'aircanvas-ui.html')
              }
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              HTML ↓
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
