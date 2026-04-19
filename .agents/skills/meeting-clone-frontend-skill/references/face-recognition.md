# Face Recognition (TensorFlow.js / face-api.js) Reference

## Setup

### 1. Copy models to public/
```bash
# After installing @vladmandic/face-api
cp -r node_modules/@vladmandic/face-api/model public/models
```

Required model files in `public/models/`:
- `tiny_face_detector_model-weights_manifest.json`
- `face_landmark_68_model-weights_manifest.json`
- `face_recognition_model-weights_manifest.json`

### 2. Load models once (in App.tsx or a provider)
```ts
// lib/faceapi.ts
import * as faceapi from '@vladmandic/face-api'

let modelsLoaded = false

export async function loadFaceModels() {
  if (modelsLoaded) return
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
  ])
  modelsLoaded = true
}

export { faceapi }
```

---

## FaceSetupWizard (Onboarding — save embeddings)

This component is shown ONCE when a user hasn't registered their face yet (`user.face_embeddings.length === 0`).

```tsx
// components/attendance/FaceSetupWizard.tsx
import { useRef, useEffect, useState } from 'react'
import { faceapi, loadFaceModels } from '@/lib/faceapi'
import { useMutation } from '@tanstack/react-query'
import { saveFaceEmbeddings } from '@/api/attendance.api'

export function FaceSetupWizard({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'capturing' | 'done'>('loading')
  const [captureCount, setCaptureCount] = useState(0)
  const descriptorsRef = useRef<number[][]>([])

  const mutation = useMutation({
    mutationFn: saveFaceEmbeddings,
    onSuccess: onComplete
  })

  useEffect(() => {
    async function init() {
      await loadFaceModels()
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setStatus('ready')
      }
    }
    init()
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Capture 5 frames for robustness
  const captureFrame = async () => {
    if (!videoRef.current) return
    setStatus('capturing')

    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!detection) {
      alert('Không phát hiện khuôn mặt. Hãy thử lại.')
      setStatus('ready')
      return
    }

    const descriptor = Array.from(detection.descriptor) // Float32Array → number[]
    descriptorsRef.current.push(descriptor)
    const newCount = captureCount + 1
    setCaptureCount(newCount)

    if (newCount >= 5) {
      // Save all descriptors to backend
      mutation.mutate(descriptorsRef.current)
      setStatus('done')
    } else {
      setStatus('ready')
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <video ref={videoRef} autoPlay muted className="w-80 rounded-xl border" />
      <p className="text-sm text-muted-foreground">
        Đã chụp: {captureCount}/5 góc
      </p>
      <button
        onClick={captureFrame}
        disabled={status !== 'ready'}
        className="..."
      >
        {status === 'capturing' ? 'Đang xử lý...' : 'Chụp khuôn mặt'}
      </button>
    </div>
  )
}
```

---

## useFaceRecognition Hook (In-Meeting Recognition Loop)

```tsx
// hooks/useFaceRecognition.ts
import { useEffect, useRef, useCallback } from 'react'
import { faceapi, loadFaceModels } from '@/lib/faceapi'
import { checkInAttendance } from '@/api/attendance.api'
import { getSocket } from '@/socket/socket'
import { CHAT_EVENTS } from '@/socket/events'
import { useAuthStore } from '@/stores/authStore'

const RECOGNITION_THRESHOLD = 0.5
const DETECTION_INTERVAL_MS = 3000

export function useFaceRecognition(
  videoRef: React.RefObject<HTMLVideoElement>,
  roomCode: string,
  storedDescriptors: number[][]   // from user profile, fetched on join
) {
  const checkedIn = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const socket = getSocket()
  const currentUser = useAuthStore(s => s.user)

  const runDetection = useCallback(async () => {
    if (!videoRef.current || checkedIn.current) return

    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!detection) return

    const incoming = detection.descriptor

    // Compare against all stored embeddings — take minimum distance
    const distances = storedDescriptors.map(stored =>
      faceapi.euclideanDistance(incoming, new Float32Array(stored))
    )
    const minDistance = Math.min(...distances)

    if (minDistance < RECOGNITION_THRESHOLD) {
      checkedIn.current = true
      clearInterval(intervalRef.current!)

      // Notify backend
      await checkInAttendance(roomCode, minDistance)

      // Notify chat
      socket.emit(CHAT_EVENTS.SYSTEM_ALERT, {
        message: `✅ ${currentUser?.full_name} đã điểm danh thành công`
      })
    }
  }, [videoRef, roomCode, storedDescriptors, socket, currentUser])

  useEffect(() => {
    if (storedDescriptors.length === 0) return

    async function start() {
      await loadFaceModels()
      intervalRef.current = setInterval(runDetection, DETECTION_INTERVAL_MS)
    }

    start()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [runDetection, storedDescriptors])

  return { isCheckedIn: checkedIn.current }
}
```

---

## attendance.api.ts

```ts
// api/attendance.api.ts
import { api } from './client'

export async function saveFaceEmbeddings(descriptors: number[][]) {
  return api.post('/api/v1/attendance/face-embeddings', { descriptors })
}

export async function checkInAttendance(roomCode: string, confidenceScore: number) {
  return api.post(`/api/v1/attendance/${roomCode}/check-in`, { confidence_score: confidenceScore })
}

export async function getAttendanceStats(roomCode: string) {
  return api.get(`/api/v1/attendance/${roomCode}/stats`)
}
```

---

## Performance Notes

- `TinyFaceDetector` is fast enough for 3-second polling; `SsdMobilenetv1` is more accurate but slower.
- Run detection in a `setInterval` loop — never block the React render cycle.
- Stop the loop once `checkedIn.current = true` to save CPU.
- Model files total ~6 MB — show a loading spinner while `loadFaceModels()` resolves.
- Consider running in a Web Worker for large-scale apps (out of scope for MVP).
