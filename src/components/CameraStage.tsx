import { useEffect, useRef, useState } from 'react'
import { HandLandmarker } from '@mediapipe/tasks-vision'
import { useHandLandmarker } from '../hooks/useHandLandmarker'
import { PointFilter } from '../lib/filters'
import { nextPinchState, penPoint, pinchRatio, type Point } from '../lib/pinch'
import { simplifyStroke } from '../lib/simplify'
import { drawStroke, INK_COLOR, INK_WIDTH, type Stroke } from '../lib/strokes'

type CameraStatus = 'starting' | 'ready' | 'denied' | 'error'

export function CameraStage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const inkCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const currentStrokeRef = useRef<Stroke | null>(null)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting')
  // mirrors strokesRef.current.length so the buttons re-render on changes
  const [strokeCount, setStrokeCount] = useState(0)
  const { landmarkerRef, status: modelStatus, error: modelError } = useHandLandmarker()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let stream: MediaStream | null = null
    let rafId = 0
    let lastVideoTime = -1
    let pinched = false
    const penFilter = new PointFilter()

    function endStroke(w: number, h: number) {
      const stroke = currentStrokeRef.current
      currentStrokeRef.current = null
      if (stroke && stroke.points.length > 1) {
        stroke.points = simplifyStroke(stroke.points, w, h)
        strokesRef.current.push(stroke)
        setStrokeCount(strokesRef.current.length)
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
        if (pinched && !wasPinched) {
          currentStrokeRef.current = { points: [pen], color: INK_COLOR, width: INK_WIDTH }
        } else if (pinched && currentStrokeRef.current) {
          currentStrokeRef.current.points.push(pen)
        } else if (!pinched && wasPinched) {
          endStroke(w, h)
        }
      } else {
        penFilter.reset() // don't drag old state into the hand's re-entry point
        if (pinched) {
          // hand lost mid-stroke: lift the pen instead of drawing a jump later
          pinched = false
          endStroke(w, h)
        }
      }

      // --- ink layer: all finished strokes + the one being drawn ---
      const ink = inkCanvas.getContext('2d')!
      ink.clearRect(0, 0, w, h)
      for (const s of strokesRef.current) drawStroke(ink, s, w, h)
      if (currentStrokeRef.current) drawStroke(ink, currentStrokeRef.current, w, h)

      // --- overlay layer: faint skeleton + pen cursor ---
      const ctx = overlay.getContext('2d')!
      ctx.clearRect(0, 0, w, h)
      if (!landmarks) return

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
      if (!pen) return
      ctx.beginPath()
      ctx.arc(pen.x * w, pen.y * h, 14, 0, Math.PI * 2)
      if (pinched) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.95)'
        ctx.fill()
      } else {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)'
        ctx.lineWidth = 3
        ctx.stroke()
      }
    }

    start()
    return () => {
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [landmarkerRef])

  function undo() {
    strokesRef.current.pop()
    setStrokeCount(strokesRef.current.length)
  }

  function clear() {
    strokesRef.current = []
    setStrokeCount(0)
  }

  const hasStrokes = strokeCount > 0

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
      <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
        <video ref={videoRef} playsInline muted className="w-full -scale-x-100" />
        <canvas
          ref={inkCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        {statusLabel && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-lg text-white">
            {statusLabel}
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={undo}
          disabled={!hasStrokes}
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
