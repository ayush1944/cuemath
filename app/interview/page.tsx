'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { TranscriptEntry } from '@/types'

type InterviewState = 'loading' | 'ai_speaking' | 'listening' | 'processing' | 'evaluating' | 'error'

const SILENCE_THRESHOLD = 0.015
const SILENCE_DURATION_MS = 1500
const MAX_SILENCE_MS = 15000

/* ── Orb ── */
function Orb({ state, muted }: { state: InterviewState; muted: boolean }) {
  const isListening = state === 'listening' && !muted
  const isSpeaking  = state === 'ai_speaking'
  const isBusy      = state === 'processing' || state === 'evaluating'

  const gradient = isBusy
    ? 'radial-gradient(circle at 38% 32%, #f1f5f9, #cbd5e1, #94a3b8)'
    : muted
    ? 'radial-gradient(circle at 38% 32%, #fca5a5, #f87171, #ef4444)'
    : isListening
    ? 'radial-gradient(circle at 38% 32%, #fef08a, #fbbf24, #f97316, #ef4444, #ec4899)'
    : isSpeaking
    ? 'radial-gradient(circle at 38% 32%, #e0e7ff, #a5b4fc, #818cf8, #6366f1, #4338ca)'
    : 'radial-gradient(circle at 38% 32%, #fed7aa, #fb923c, #f97316, #ea580c)'

  const shadow = isListening
    ? '0 0 28px rgba(249,115,22,0.55), inset 0 2px 0 rgba(255,255,255,0.45)'
    : isSpeaking
    ? '0 0 28px rgba(99,102,241,0.55), inset 0 2px 0 rgba(255,255,255,0.45)'
    : muted
    ? '0 0 20px rgba(239,68,68,0.4), inset 0 2px 0 rgba(255,255,255,0.35)'
    : '0 4px 16px rgba(0,0,0,0.12), inset 0 2px 0 rgba(255,255,255,0.4)'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      {/* Ripple ring */}
      {(isListening || isSpeaking) && (
        <>
          <div className="absolute rounded-full" style={{
            inset: -10,
            background: isListening
              ? 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
            animation: 'pulse-ring 2.4s ease-in-out infinite',
          }} />
          <div className="absolute rounded-full" style={{
            inset: -5,
            border: `1.5px solid ${isListening ? 'rgba(249,115,22,0.3)' : 'rgba(99,102,241,0.3)'}`,
            animation: 'pulse-ring 2.4s ease-in-out infinite 0.4s',
          }} />
        </>
      )}
      <div style={{
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: gradient,
        boxShadow: shadow,
        transition: 'background 0.6s ease, box-shadow 0.6s ease',
        animation: (isListening || isSpeaking) ? 'pulse-ring 3s ease-in-out infinite' : isBusy ? 'shimmer 1.4s ease-in-out infinite' : 'none',
      }} />
    </div>
  )
}

/* ── Icons ── */
function MicIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ) : (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

/* ── Main component ── */
function InterviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  const [state, setState]               = useState<InterviewState>('loading')
  const [transcript, setTranscript]     = useState<TranscriptEntry[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(1)
  const [elapsed, setElapsed]           = useState(0)
  const [errorMsg, setErrorMsg]         = useState('')
  const [hasSpeech, setHasSpeech]       = useState(false)
  const [candidateName, setCandidateName] = useState('You')
  const [isMuted, setIsMuted]           = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [micDevices, setMicDevices]     = useState<MediaDeviceInfo[]>([])
  const [countdown, setCountdown]       = useState<number | null>(null)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  const streamRef          = useRef<MediaStream | null>(null)
  const recorderRef        = useRef<MediaRecorder | null>(null)
  const chunksRef          = useRef<Blob[]>([])
  const audioCtxRef        = useRef<AudioContext | null>(null)
  const silenceTimerRef    = useRef<NodeJS.Timeout | null>(null)
  const maxSilenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const vadIntervalRef     = useRef<NodeJS.Timeout | null>(null)
  const hadSpeechRef       = useRef(false)
  const transcriptRef      = useRef<TranscriptEntry[]>([])
  const questionRef        = useRef(1)
  const timerRef           = useRef<NodeJS.Timeout | null>(null)
  const chatEndRef         = useRef<HTMLDivElement | null>(null)
  const startListeningRef  = useRef<() => Promise<void>>(async () => {})
  const runTurnRef         = useRef<(a?: string) => Promise<void>>(async () => {})

  useEffect(() => { transcriptRef.current = transcript }, [transcript])
  useEffect(() => { questionRef.current = currentQuestion }, [currentQuestion])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [transcript])

  useEffect(() => {
    const start = Date.now()
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.json())
      .then(({ session }) => { if (session?.candidateName) setCandidateName(session.candidateName) })
      .catch(() => {})
  }, [sessionId])

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devs => setMicDevices(devs.filter(d => d.kind === 'audioinput')))
      .catch(() => {})
  }, [])

  /* ── Stop recording ── */
  const stopRecording = useCallback(() => {
    if (vadIntervalRef.current) clearInterval(vadIntervalRef.current)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (maxSilenceTimerRef.current) clearTimeout(maxSilenceTimerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  /* ── Mute toggle ── */
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev
      streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next })
      return next
    })
  }, [])

  /* ── TTS ── */
  const speakText = useCallback(async (text: string) => {
    setState('ai_speaking')
    // Cancel any queued browser speech before starting
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.headers.get('content-type')?.includes('audio/mpeg')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        await new Promise<void>(resolve => {
          audio.onended = () => resolve()
          audio.onerror = () => resolve()
          audio.play().catch(() => resolve())
        })
        URL.revokeObjectURL(url)
      } else {
        const { text: ttsText } = await res.json()
        await new Promise<void>(resolve => {
          const utter = new SpeechSynthesisUtterance(ttsText)
          utter.rate = 0.95
          utter.onend = () => resolve()
          utter.onerror = () => resolve()
          speechSynthesis.speak(utter)
        })
      }
    } catch { /* silent fail */ }
  }, [])

  /* ── Start listening ── */
  const startListening = useCallback(async () => {
    setState('listening')
    hadSpeechRef.current = false
    setHasSpeech(false)
    chunksRef.current = []

    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()

      const ctx = audioCtxRef.current
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(streamRef.current).connect(analyser)

      const recorder = new MediaRecorder(streamRef.current)
      recorderRef.current = recorder
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      recorder.onstop = async () => {
        if (chunksRef.current.length === 0) { runTurnRef.current(undefined); return }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size < 1000) { runTurnRef.current('[no response]'); return }
        setState('processing')
        const form = new FormData()
        form.append('file', blob, 'audio.webm')
        try {
          const res = await fetch('/api/transcribe', { method: 'POST', body: form })
          const { text } = await res.json()
          runTurnRef.current(text || '[unclear audio]')
        } catch { runTurnRef.current('[unclear audio]') }
      }

      recorder.start(100)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      vadIntervalRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128; sum += v * v
        }
        const rms = Math.sqrt(sum / dataArray.length)
        // Skip VAD if muted
        if (streamRef.current?.getAudioTracks()[0]?.enabled === false) return

        if (rms > SILENCE_THRESHOLD) {
          if (!hadSpeechRef.current) { hadSpeechRef.current = true; setHasSpeech(true) }
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
          if (maxSilenceTimerRef.current) { clearTimeout(maxSilenceTimerRef.current); maxSilenceTimerRef.current = null }
        } else if (hadSpeechRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => stopRecording(), SILENCE_DURATION_MS)
        }
      }, 100)

      maxSilenceTimerRef.current = setTimeout(() => {
        if (!hadSpeechRef.current) stopRecording()
      }, MAX_SILENCE_MS)
    } catch {
      setErrorMsg('Microphone not available. Please check permissions.')
      setState('error')
    }
  }, [stopRecording])

  /* ── Interview turn ── */
  const runInterviewTurn = useCallback(async (candidateAnswer?: string) => {
    setState('processing')
    const currentTranscript = transcriptRef.current
    const updatedTranscript = candidateAnswer
      ? [...currentTranscript, { role: 'candidate' as const, content: candidateAnswer, timestamp: new Date().toISOString() }]
      : currentTranscript

    if (candidateAnswer) setTranscript(updatedTranscript)

    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, transcript: updatedTranscript }),
      })
      if (!res.ok) throw new Error(`Interview API ${res.status}`)
      const { utterance, currentQuestionIndex, isComplete } = await res.json()

      setTranscript(prev => [...prev, { role: 'ai', content: utterance, timestamp: new Date().toISOString(), questionNumber: currentQuestionIndex }])

      if (isComplete) {
        await speakText(utterance)
        setState('evaluating')
        const evalRes = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        if (evalRes.ok) router.push(`/report/${sessionId}`)
        else { setErrorMsg('Evaluation failed. Please contact support.'); setState('error') }
        return
      }

      setCurrentQuestion(currentQuestionIndex)
      await speakText(utterance)
      startListeningRef.current()
    } catch {
      setErrorMsg('Connection error. Please refresh and try again.')
      setState('error')
    }
  }, [sessionId, speakText, router])

  useEffect(() => { startListeningRef.current = startListening }, [startListening])
  useEffect(() => { runTurnRef.current = runInterviewTurn }, [runInterviewTurn])

  /* ── Mount: 3-second countdown then start interview ── */
  useEffect(() => {
    if (!sessionId) { router.push('/'); return }
    let cancelled = false
    let countdownTimer: ReturnType<typeof setInterval> | null = null

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        let count = 3
        setCountdown(count)
        countdownTimer = setInterval(() => {
          count -= 1
          if (count > 0) {
            setCountdown(count)
          } else {
            clearInterval(countdownTimer!)
            countdownTimer = null
            setCountdown(null)
            if (!cancelled) runTurnRef.current()
          }
        }, 1000)
      })
      .catch(() => {
        if (!cancelled) { setErrorMsg('Microphone access is required.'); setState('error') }
      })

    return () => {
      cancelled = true
      if (countdownTimer) clearInterval(countdownTimer)
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (maxSilenceTimerRef.current) clearTimeout(maxSilenceTimerRef.current)
    }
  }, [sessionId, router])

  /* ── Helpers ── */
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const initials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const statusLabel: Record<InterviewState, string> = {
    loading:    'Connecting…',
    ai_speaking:'Speaking…',
    listening:  isMuted ? 'Muted' : hasSpeech ? 'Listening…' : 'Your turn — speak now',
    processing: 'Processing…',
    evaluating: 'Preparing results…',
    error:      errorMsg,
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f6f6f3', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ── Left sidebar ── */}
      <aside style={{ width: 288, padding: 20, flexShrink: 0, display: 'none' }} className="md:flex! flex-col gap-4">
        {/* Brand card */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #ebebeb', padding: '24px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15 }}>C</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Cuemath</div>
              <div style={{ fontSize: 11, color: '#999' }}>Tutor Screening</div>
            </div>
          </div>

          <div style={{ height: 1, background: '#f0f0ec', margin: '0 0 20px' }} />

          <p style={{ fontSize: 13, color: '#555', lineHeight: 1.65, margin: '0 0 8px' }}>
            You&apos;re being screened for{' '}
            <strong style={{ color: '#111' }}>Cuemath Tutor</strong>.
          </p>
          <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>Take a breath. Be yourself.</p>
        </div>

        {/* Progress card */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #ebebeb', padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Progress</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>Q{currentQuestion} / 5</span>
          </div>
          <div style={{ height: 6, background: '#f0f0ec', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#f97316,#ef4444)', width: `${Math.min(((currentQuestion - 1) / 5) * 100, 100)}%`, transition: 'width 0.7s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {[1,2,3,4,5].map(n => (
              <div key={n} style={{ width: 7, height: 7, borderRadius: '50%', background: n <= currentQuestion - 1 ? '#f97316' : n === currentQuestion ? '#fbbf24' : '#e5e5e0', transition: 'background 0.4s' }} />
            ))}
          </div>
        </div>

        {/* Tips card */}
        <div style={{ background: 'linear-gradient(135deg,#fff7ed,#fff)', borderRadius: 20, border: '1px solid #fed7aa', padding: '18px 22px' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#ea580c', margin: '0 0 8px' }}>Quick tips</p>
          {['Speak clearly and at a comfortable pace', 'Take a moment to think before answering', 'Specific examples work best'].map((tip, i) => (
            <p key={i} style={{ fontSize: 11.5, color: '#78350f', margin: '4px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#f97316', flexShrink: 0 }}>·</span>{tip}
            </p>
          ))}
        </div>
      </aside>

      {/* ── Chat panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderLeft: '1px solid #efefeb', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #f2f2ee', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>AI</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Interviewer</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
            <span style={{ fontSize: 11.5, color: '#999' }}>Cuemath · AI-powered screening</span>
          </div>
          {/* LIVE indicator — visible while interview is actively running */}
          {(state === 'listening' || state === 'ai_speaking') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 99, padding: '3px 9px' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse-ring 1.8s ease-in-out infinite' }} />
              <span style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 700, letterSpacing: '0.04em' }}>LIVE</span>
            </div>
          )}
          {/* Mobile Q counter */}
          <div className="md:hidden" style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#ea580c' }}>
            Q{currentQuestion}/5
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Countdown / connecting shimmer */}
          {state === 'loading' && (
            countdown !== null ? (
              <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '56px 0' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 36, fontWeight: 800, boxShadow: '0 0 32px rgba(249,115,22,0.35)' }}>
                  {countdown}
                </div>
                <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Interview starting…</p>
                <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>Make sure you&apos;re in a quiet place</p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>C</div>
                <div style={{ display: 'flex', gap: 5, padding: '10px 14px', background: '#f8f8f5', borderRadius: '18px 18px 18px 4px' }}>
                  {[0,1,2].map(i => <div key={i} className="shimmer" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ccc', animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            )
          )}

          {transcript.map((entry, i) => {
            const isAI = entry.role === 'ai'
            return (
              <div key={i} className="fade-in-up" style={{ display: 'flex', flexDirection: isAI ? 'row' : 'row-reverse', alignItems: 'flex-end', gap: 10 }}>
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                  background: isAI ? 'linear-gradient(135deg,#f97316,#ef4444)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                }}>
                  {isAI ? 'C' : initials(candidateName)}
                </div>
                {/* Bubble */}
                <div style={{
                  maxWidth: 420,
                  padding: '11px 16px',
                  borderRadius: isAI ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                  background: isAI ? '#f8f8f5' : '#eef2ff',
                  fontSize: 14, lineHeight: 1.6,
                  color: '#222',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  {entry.content}
                </div>
              </div>
            )
          })}

          {/* Typing dots */}
          {(state === 'processing' || state === 'evaluating') && (
            <div className="fade-in-up" style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>C</div>
              <div style={{ display: 'flex', gap: 5, padding: '12px 16px', background: '#f8f8f5', borderRadius: '18px 18px 18px 4px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {[0,1,2].map(i => <div key={i} className="shimmer" style={{ width: 6, height: 6, borderRadius: '50%', background: '#bbb', animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Audio settings — collapsible */}
        <div style={{ borderTop: '1px solid #f2f2ee', flexShrink: 0 }}>
          <button
            onClick={() => setSettingsOpen(o => !o)}
            style={{ width: '100%', padding: '11px 24px', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            <span style={{ fontSize: 12, color: '#999', flex: 1 }}>Audio settings</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2.5" style={{ transform: settingsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {settingsOpen && (
            <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: '#aaa', fontWeight: 500, display: 'block', marginBottom: 5 }}>MICROPHONE</label>
                <select
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #e8e8e4', fontSize: 12.5, color: '#333', background: '#fafaf8', outline: 'none', cursor: 'pointer' }}
                  onChange={async (e) => {
                    const deviceId = e.target.value
                    if (!deviceId) return
                    try {
                      const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } })
                      streamRef.current?.getTracks().forEach(t => t.stop())
                      streamRef.current = newStream
                      audioCtxRef.current = null
                    } catch { /* ignore */ }
                  }}
                >
                  {micDevices.length === 0
                    ? <option>Default microphone</option>
                    : micDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0,6)}`}</option>)
                  }
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: state === 'listening' ? '#22c55e' : '#e5e7eb', flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: '#888' }}>
                  {state === 'listening' ? (isMuted ? 'Muted' : 'Mic active') : 'Mic standby'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid #f2f2ee', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          {/* Timer */}
          <span style={{ fontSize: 13, color: '#aaa', fontVariantNumeric: 'tabular-nums', width: 52 }}>{fmt(elapsed)}</span>

          {/* Orb + label */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Orb state={state} muted={isMuted} />
            <span style={{ fontSize: 11, color: '#aaa', fontWeight: 500 }}>{statusLabel[state]}</span>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, width: 'auto', justifyContent: 'flex-end' }}>
            {state === 'error' ? (
              <button onClick={() => router.push('/')}
                style={{ padding: '8px 18px', borderRadius: 99, fontSize: 12, fontWeight: 600, color: '#fff', background: '#ef4444', border: 'none', cursor: 'pointer' }}>
                Restart
              </button>
            ) : (
              <>
                {/* Mute toggle */}
                <button
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: isMuted ? '#ef4444' : '#111',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff',
                    boxShadow: isMuted ? '0 0 0 3px rgba(239,68,68,0.25)' : 'none',
                    transition: 'all 0.2s ease',
                  }}>
                  <MicIcon muted={isMuted} />
                </button>

                {/* Submit answer early (only during listening) */}
                {state === 'listening' && (
                  <button
                    onClick={stopRecording}
                    title="Submit answer"
                    style={{
                      height: 44, padding: '0 16px', borderRadius: 99,
                      background: 'linear-gradient(135deg,#f97316,#ef4444)',
                      border: 'none', cursor: 'pointer',
                      color: '#fff', fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 2px 12px rgba(249,115,22,0.4)',
                    }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
                    Send
                  </button>
                )}

                {/* End interview — opens confirmation modal */}
                <button
                  onClick={() => setShowEndConfirm(true)}
                  title="End interview"
                  disabled={state === 'evaluating'}
                  style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#f97316,#ef4444)',
                    border: 'none', cursor: state === 'evaluating' ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff',
                    opacity: state === 'evaluating' ? 0.4 : 1,
                    boxShadow: '0 2px 12px rgba(239,68,68,0.35)',
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── End interview confirmation modal ── */}
      {showEndConfirm && (
        <div
          onClick={() => setShowEndConfirm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="fade-in-up"
            style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', maxWidth: 360, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>End interview?</h2>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, margin: '0 0 24px' }}>
              Your progress won&apos;t be saved and you&apos;ll need to start over. Are you sure?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#f5f5f2', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#555' }}
              >
                Keep going
              </button>
              <button
                onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); router.push('/') }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#fff', boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}
              >
                End interview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InterviewPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f6f3' }}>
        <p style={{ color: '#aaa', fontSize: 14 }}>Loading…</p>
      </div>
    }>
      <InterviewContent />
    </Suspense>
  )
}
