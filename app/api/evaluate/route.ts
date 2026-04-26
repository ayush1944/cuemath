import { NextResponse } from 'next/server'
import { evaluateInterview } from '@/lib/claude'
import { getSession, saveSession } from '@/lib/redis'

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json()
    const session = await getSession(sessionId)
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const candidateText = session.transcript
      .filter((e) => e.role === 'candidate')
      .map((e) => e.content)
      .join(' ')
    const wordCount = candidateText.split(/\s+/).filter(Boolean).length

    const rubric = await evaluateInterview(
      session.transcript,
      session.candidateName,
      session.candidateRole,
      wordCount
    )

    session.rubric = rubric
    session.status = 'completed'
    session.completedAt = new Date().toISOString()
    await saveSession(session)

    return NextResponse.json({ rubric })
  } catch (e) {
    console.error('POST /api/evaluate', e)
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 })
  }
}
