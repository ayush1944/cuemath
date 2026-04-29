import { NextResponse } from 'next/server'
import { getInterviewerResponse } from '@/lib/claude'
import { getSession, saveSession } from '@/lib/redis'
import type { TranscriptEntry } from '@/types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sessionId: string = body?.sessionId
    const transcript: TranscriptEntry[] = body?.transcript

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }
    if (!Array.isArray(transcript)) {
      return NextResponse.json({ error: 'Invalid transcript' }, { status: 400 })
    }

    // Run LLM call and Redis read in parallel to cut one round-trip from the latency chain
    const [{ utterance, currentQuestionIndex, utteranceType, isComplete }, session] =
      await Promise.all([getInterviewerResponse(transcript), getSession(sessionId)])

    if (session) {
      const aiEntry: TranscriptEntry = {
        role: 'ai',
        content: utterance,
        timestamp: new Date().toISOString(),
        questionNumber: currentQuestionIndex,
      }
      session.transcript = transcript.concat(aiEntry)
      session.currentQuestionIndex = currentQuestionIndex
      session.lastUtteranceType = utteranceType
      await saveSession(session)
    }

    return NextResponse.json({ utterance, currentQuestionIndex, utteranceType, isComplete })
  } catch (e) {
    console.error('POST /api/interview', e)
    return NextResponse.json({ error: 'Interview API error' }, { status: 500 })
  }
}
