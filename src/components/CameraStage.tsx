import { useEffect, useRef, useState } from 'react'
import { HandLandmarker } from '@mediapipe/tasks-vision'
import { useHandLandmarker } from '../hooks/useHandLandmarker'

const INDEX_FINGER_TIP = 8

type CameraStatus = 'starting' | 'ready' | 'denied' | 'error'

export function CameraStage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting')
  const { landmarkerRef, status: modelStatus, error: modelError } = useHandLandmarker()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let stream: MediaStream | null = null
    let rafId = 0
    let lastVideoTime = -1

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
      const canvas = canvasRef.current
      const landmarker = landmarkerRef.current
      if (!video || !canvas || !landmarker || video.readyState < 2) return
      // Only run detection when a new frame is available.
      if (video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }

      const result = landmarker.detectForVideo(video, performance.now())
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const landmarks = result.landmarks[0]
      if (!landmarks) return

      // The video element is mirrored via CSS; mirror the overlay to match.
      ctx.save()
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)

      ctx.strokeStyle = 'rgba(74, 222, 128, 0.9)'
      ctx.lineWidth = 3
      for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
        const a = landmarks[start]
        const b = landmarks[end]
        ctx.beginPath()
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height)
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height)
        ctx.stroke()
      }

      landmarks.forEach((lm, i) => {
        const isTip = i === INDEX_FINGER_TIP
        ctx.beginPath()
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, isTip ? 10 : 5, 0, Math.PI * 2)
        ctx.fillStyle = isTip ? 'rgba(251, 191, 36, 0.95)' : 'rgba(34, 197, 94, 0.9)'
        ctx.fill()
      })

      ctx.restore()
    }

    start()
    return () => {
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
    }
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
    <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl">
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full -scale-x-100"
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {statusLabel && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-lg text-white">
          {statusLabel}
        </div>
      )}
    </div>
  )
}
