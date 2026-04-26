import { NextResponse } from 'next/server'
import { getInterviewerResponse } from '@/lib/claude'
import { getSession, saveSession } from '@/lib/redis'
import type { TranscriptEntry } from '@/types'

export async function POST(request: Request) {
  try {
    const { sessionId, transcript, currentQuestion } = await request.json() as {
      sessionId: string
      transcript: TranscriptEntry[]
      currentQuestion: number
    }

    const text = await getInterviewerResponse(transcript, currentQuestion)
    const isComplete = text.includes('[INTERVIEW_COMPLETE]')
    const cleanText = text.replace('[INTERVIEW_COMPLETE]', '').trim()

    // Persist transcript update to Redis
    const session = await getSession(sessionId)
    if (session) {
      const aiEntry: TranscriptEntry = {
        role: 'ai',
        content: cleanText,
        timestamp: new Date().toISOString(),
        questionNumber: currentQuestion,
      }
      session.transcript = transcript.concat(aiEntry)
      if (isComplete) {
        session.status = 'in_progress' // will become 'completed' after evaluate
      }
      await saveSession(session)
    }

    return NextResponse.json({ text: cleanText, isComplete })
  } catch (e) {
    console.error('POST /api/interview', e)
    return NextResponse.json({ error: 'Interview API error' }, { status: 500 })
  }
}
