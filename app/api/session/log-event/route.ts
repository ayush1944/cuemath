import { NextResponse } from 'next/server'
import { getSession, saveSession } from '@/lib/redis'

export async function POST(request: Request) {
  try {
    const { sessionId, event, timestamp, hidden_duration_ms } = await request.json() as {
      sessionId: string
      event: 'tab_hidden' | 'tab_visible'
      timestamp: number
      hidden_duration_ms?: number
    }

    if (!sessionId || !event) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (!session.focus_events) session.focus_events = []
    session.focus_events.push({ event, timestamp, hidden_duration_ms })
    await saveSession(session)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/session/log-event', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
