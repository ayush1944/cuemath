import { NextResponse } from 'next/server'
import { getInterviewerResponse } from '@/lib/claude'
import { getSession, saveSession } from '@/lib/redis'
import type { TranscriptEntry } from '@/types'

export async function POST(request: Request) {
  try {
    const { sessionId, transcript } = await request.json() as {
      sessionId: string
      transcript: TranscriptEntry[]
    }

    const { utterance, currentQuestionIndex, utteranceType, isComplete } =
      await getInterviewerResponse(transcript)

    const session = await getSession(sessionId)
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
