'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type CheckState = 'idle' | 'requesting' | 'recording' | 'playing' | 'done' | 'error'

function MicCheckContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  const [state, setState] = useState<CheckState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!sessionId) router.push('/')
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [sessionId, router])

  async function startRecording() {
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => { URL.revokeObjectURL(url); objectUrlRef.current = null; setState('done') }
        audio.onerror = () => { URL.revokeObjectURL(url); objectUrlRef.current = null; setState('done') }
        setState('playing')
        audio.play().catch(() => { URL.revokeObjectURL(url); objectUrlRef.current = null; setState('done') })
      }

      setState('recording')
      recorder.start()
      setTimeout(() => recorder.stop(), 3000)
    } catch {
      setErrorMsg('Microphone access denied. Please allow mic access and try again.')
      setState('error')
    }
  }

  function retry() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setState('idle')
    setErrorMsg('')
  }

  function proceed() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    router.push(`/interview?session=${sessionId}`)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #FAFAF8 0%, #FFF7ED 100%)' }}>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
            style={{ background: state === 'recording' ? '#FED7AA' : '#F3F4F6' }}>
            <svg className="w-8 h-8" style={{ color: state === 'recording' ? '#F97316' : '#9CA3AF' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Mic check</h1>
          <p className="text-gray-500 text-sm">
            {state === 'idle' && "Let's make sure your microphone works. Click record and say a few words."}
            {state === 'requesting' && 'Requesting microphone access...'}
            {state === 'recording' && 'Recording for 3 seconds... speak now!'}
            {state === 'playing' && 'Playing back your recording...'}
            {state === 'done' && 'Sounded good? You can retry or continue to the interview.'}
            {state === 'error' && errorMsg}
          </p>
        </div>

        {(state === 'idle' || state === 'error') && (
          <button onClick={startRecording}
            className="w-full py-3 rounded-xl font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #F97316, #ef4444)' }}>
            Record 3 seconds
          </button>
        )}

        {state === 'recording' && (
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full pulse-ring"
              style={{ background: '#F97316' }} />
          </div>
        )}

        {state === 'playing' && (
          <p className="text-orange-500 font-medium">Playing...</p>
        )}

        {state === 'done' && (
          <div className="flex gap-3">
            <button onClick={retry}
              className="flex-1 py-3 rounded-xl border border-gray-200 font-medium text-gray-700 hover:bg-gray-50 transition">
              Retry
            </button>
            <button onClick={proceed}
              className="flex-1 py-3 rounded-xl font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #F97316, #ef4444)' }}>
              Start interview →
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

export default function MicCheckPage() {
  return (
    <Suspense>
      <MicCheckContent />
    </Suspense>
  )
}
