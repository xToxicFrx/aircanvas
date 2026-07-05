import { useEffect, useRef, useState } from 'react'
import { HandLandmarker } from '@mediapipe/tasks-vision'
import { useHandLandmarker } from '../hooks/useHandLandmarker'
import { strokeHit } from '../lib/erase'
import { PointFilter } from '../lib/filters'
import { nextPinchState, penPoint, pinchRatio, type Point } from '../lib/pinch'
import { simplifyStroke } from '../lib/simplify'
import { drawStroke, INK_WIDTH, type Stroke } from '../lib/strokes'

type CameraStatus = 'starting' | 'ready' | 'denied' | 'error'

export const INK_COLORS = ['#fbbf24', '#34d399', '#38bdf8', '#f472b6']

type Tool = { kind: 'pen'; color: string } | { kind: 'eraser' }

const ERASER_RADIUS_PX = 28
const DWELL_MS = 600
const MAX_HISTORY = 50

const TOOL_BUTTONS: { id: string; color?: string }[] = [
  ...INK_COLORS.map((color) => ({ id: `pen:${color}`, color })),
  { id: 'eraser' },
]

export function CameraStage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inkCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>())

  const strokesRef = useRef<Stroke[]>([])
  const currentStrokeRef = useRef<Stroke | null>(null)
  const historyRef = useRef<Stroke[][]>([])
  const toolRef = useRef<Tool>({ kind: 'pen', color: INK_COLORS[0] })

  const [tool, setToolState] = useState<Tool>(toolRef.current)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting')
  const [hasStrokes, setHasStrokes] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const { landmarkerRef, status: modelStatus, error: modelError } = useHandLandmarker()

  // These helpers only touch refs and stable setters, so it's safe for the
  // one-time effect below to close over them.
  function selectTool(t: Tool) {
    toolRef.current = t
    setToolState(t)
  }

  function syncUi() {
    setHasStrokes(strokesRef.current.length > 0)
    setCanUndo(historyRef.current.length > 0)
  }

  function pushHistory() {
    historyRef.current.push(strokesRef.current.slice())
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
  }

  function undo() {
    const prev = historyRef.current.pop()
    if (prev) {
      strokesRef.current = prev
      currentStrokeRef.current = null
      syncUi()
    }
  }

  function clear() {
    if (strokesRef.current.length === 0) return
    pushHistory()
    strokesRef.current = []
    syncUi()
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let stream: MediaStream | null = null
    let rafId = 0
    let lastVideoTime = -1
    let pinched = false
    let eraseSnapshotTaken = false
    let dwell: { id: string; since: number } | null = null
    let dwellArmed = true
    const penFilter = new PointFilter()

    function endStroke(w: number, h: number) {
      const stroke = currentStrokeRef.current
      currentStrokeRef.current = null
      if (stroke && stroke.points.length > 1) {
        stroke.points = simplifyStroke(stroke.points, w, h)
        pushHistory()
        strokesRef.current.push(stroke)
        syncUi()
      }
    }

    function eraseAt(pen: Point, w: number, h: number) {
      const survivors = strokesRef.current.filter(
        (s) => !strokeHit(s, pen, ERASER_RADIUS_PX, w, h),
      )
      if (survivors.length !== strokesRef.current.length) {
        if (!eraseSnapshotTaken) {
          pushHistory()
          eraseSnapshotTaken = true
        }
        strokesRef.current = survivors
        syncUi()
      }
    }

    function clearDwellVisuals(exceptId?: string) {
      for (const [id, el] of buttonsRef.current) {
        if (id !== exceptId) el.style.setProperty('--dwell', '0')
      }
    }

    /** Hover-dwell tool selection: while not pinching, holding the cursor over
     * a toolbar button for DWELL_MS selects it (progress ring fills up). */
    function updateDwell(pen: Point | null, isPinched: boolean, now: number) {
      const container = containerRef.current
      if (!pen || isPinched || !container) {
        dwell = null
        clearDwellVisuals()
        return
      }
      const rect = container.getBoundingClientRect()
      const px = rect.left + pen.x * rect.width
      const py = rect.top + pen.y * rect.height

      let hoveredId: string | null = null
      for (const [id, el] of buttonsRef.current) {
        const b = el.getBoundingClientRect()
        if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) {
          hoveredId = id
          break
        }
      }

      if (!hoveredId) {
        dwell = null
        dwellArmed = true
        clearDwellVisuals()
        return
      }
      if (!dwellArmed) return
      if (dwell?.id !== hoveredId) dwell = { id: hoveredId, since: now }

      const progress = Math.min(1, (now - dwell.since) / DWELL_MS)
      clearDwellVisuals(hoveredId)
      buttonsRef.current.get(hoveredId)?.style.setProperty('--dwell', String(progress))

      if (progress >= 1) {
        if (hoveredId === 'eraser') selectTool({ kind: 'eraser' })
        else if (hoveredId.startsWith('pen:')) {
          selectTool({ kind: 'pen', color: hoveredId.slice(4) })
        }
        dwell = null
        dwellArmed = false // re-arms once the cursor leaves the buttons
        clearDwellVisuals()
      }
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (e) {
        setCameraStatus(
          e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'error',
        )
        return
      }
      if (!video) return
      video.srcObject = stream
      await video.play()
      setCameraStatus('ready')
      rafId = requestAnimationFrame(loop)
    }

    function loop() {
      rafId = requestAnimationFrame(loop)
      const inkCanvas = inkCanvasRef.current
      const overlay = overlayCanvasRef.current
      const landmarker = landmarkerRef.current
      if (!video || !inkCanvas || !overlay || !landmarker || video.readyState < 2) return
      if (video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime

      const w = video.videoWidth
      const h = video.videoHeight
      for (const c of [inkCanvas, overlay]) {
        if (c.width !== w || c.height !== h) {
          c.width = w
          c.height = h
        }
      }

      const now = performance.now()
      const result = landmarker.detectForVideo(video, now)
      const landmarks = result.landmarks[0]

      // --- gesture / stroke state ---
      let pen: Point | null = null
      if (landmarks) {
        const wasPinched = pinched
        pinched = nextPinchState(pinched, pinchRatio(landmarks))
        // One-Euro filter runs on the pen point continuously (also while just
        // hovering) so the cursor is calm and a new stroke starts lag-free
        pen = penFilter.filter(penPoint(landmarks), now)
        const tool = toolRef.current
        if (tool.kind === 'pen') {
          if (pinched && !wasPinched) {
            currentStrokeRef.current = { points: [pen], color: tool.color, width: INK_WIDTH }
          } else if (pinched && currentStrokeRef.current) {
            currentStrokeRef.current.points.push(pen)
          } else if (!pinched && wasPinched) {
            endStroke(w, h)
          }
        } else {
          if (pinched && !wasPinched) eraseSnapshotTaken = false
          if (pinched) eraseAt(pen, w, h)
        }
      } else {
        penFilter.reset() // don't drag old state into the hand's re-entry point
        if (pinched) {
          // hand lost mid-stroke: lift the pen instead of drawing a jump later
          pinched = false
          endStroke(w, h)
        }
      }

      updateDwell(pen, pinched, now)

      // --- ink layer: all finished strokes + the one being drawn ---
      const ink = inkCanvas.getContext('2d')!
      ink.clearRect(0, 0, w, h)
      for (const s of strokesRef.current) drawStroke(ink, s, w, h)
      if (currentStrokeRef.current) drawStroke(ink, currentStrokeRef.current, w, h)

      // --- overlay layer: faint skeleton + pen cursor ---
      const ctx = overlay.getContext('2d')!
      ctx.clearRect(0, 0, w, h)
      if (!landmarks || !pen) return

      ctx.save()
      ctx.translate(w, 0)
      ctx.scale(-1, 1) // video is CSS-mirrored; mirror the skeleton to match
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.25)'
      ctx.lineWidth = 2
      for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
        const a = landmarks[start]
        const b = landmarks[end]
        ctx.beginPath()
        ctx.moveTo(a.x * w, a.y * h)
        ctx.lineTo(b.x * w, b.y * h)
        ctx.stroke()
      }
      ctx.restore()

      // pen cursor is computed in screen space already — no mirror transform
      const tool = toolRef.current
      ctx.beginPath()
      if (tool.kind === 'eraser') {
        ctx.arc(pen.x * w, pen.y * h, ERASER_RADIUS_PX, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = pinched ? 5 : 2
        ctx.stroke()
      } else {
        ctx.arc(pen.x * w, pen.y * h, 14, 0, Math.PI * 2)
        if (pinched) {
          ctx.fillStyle = tool.color
          ctx.fill()
        } else {
          ctx.strokeStyle = tool.color
          ctx.lineWidth = 3
          ctx.stroke()
        }
      }
    }

    start()
    return () => {
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landmarkerRef])

  const statusLabel =
    cameraStatus === 'denied'
      ? 'Kamera-Zugriff abgelehnt — bitte in den Browser-Einstellungen erlauben'
      : cameraStatus === 'error'
        ? 'Kamera konnte nicht gestartet werden'
        : modelStatus === 'error'
          ? `Hand-Tracking-Modell konnte nicht geladen werden: ${modelError}`
          : cameraStatus === 'starting' || modelStatus === 'loading'
            ? 'Lade Kamera und Hand-Tracking-Modell…'
            : null

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-4">
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-2xl bg-black shadow-2xl"
      >
        <video ref={videoRef} playsInline muted className="w-full -scale-x-100" />
        <canvas
          ref={inkCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        <div className="absolute top-3 left-1/2 flex -translate-x-1/2 gap-3">
          {TOOL_BUTTONS.map(({ id, color }) => {
            const selected =
              id === 'eraser'
                ? tool.kind === 'eraser'
                : tool.kind === 'pen' && tool.color === color
            return (
              <button
                key={id}
                ref={(el) => {
                  if (el) buttonsRef.current.set(id, el)
                  else buttonsRef.current.delete(id)
                }}
                onClick={() =>
                  selectTool(
                    id === 'eraser' ? { kind: 'eraser' } : { kind: 'pen', color: color! },
                  )
                }
                aria-label={id === 'eraser' ? 'Radierer' : `Stiftfarbe ${color}`}
                className={`air-btn flex h-11 w-11 items-center justify-center rounded-full border-2 text-lg transition ${
                  selected
                    ? 'scale-110 border-white'
                    : 'border-white/30 opacity-80 hover:opacity-100'
                } ${id === 'eraser' ? 'bg-zinc-700 text-white' : ''}`}
                style={color ? { backgroundColor: color } : undefined}
              >
                {id === 'eraser' ? '⌫' : ''}
              </button>
            )
          })}
        </div>
        {statusLabel && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-lg text-white">
            {statusLabel}
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
        >
          Rückgängig
        </button>
        <button
          onClick={clear}
          disabled={!hasStrokes}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
        >
          Alles löschen
        </button>
      </div>
    </div>
  )
}
