import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

// Self-hosted (copied from the installed npm package by scripts/copy-mediapipe-wasm.mjs)
// so the wasm always matches the JS API version — no CDN version drift.
const WASM_URL = '/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'

export type LandmarkerStatus = 'loading' | 'ready' | 'error'

/**
 * Loads the MediaPipe HandLandmarker once and exposes it via a ref so the
 * render loop can call detectForVideo without re-rendering React each frame.
 */
export function useHandLandmarker() {
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const [status, setStatus] = useState<LandmarkerStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
        const landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 1,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setStatus('ready')
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setStatus('error')
        }
      }
    }

    init()
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  return { landmarkerRef, status, error }
}
