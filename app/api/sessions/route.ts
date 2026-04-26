import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { saveSession, getAllSessionIds, getSession } from '@/lib/redis'
import type { Session } from '@/types'

export async function POST(request: Request) {
  try {
    const { candidateName, candidateEmail, candidateRole } = await request.json()
    if (!candidateName || !candidateEmail) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
    }

    const session: Session = {
      id: uuidv4(),
      candidateName,
      candidateEmail,
      candidateRole: candidateRole || '',
      startedAt: new Date().toISOString(),
      status: 'in_progress',
      transcript: [],
    }

    await saveSession(session)
    return NextResponse.json({ sessionId: session.id })
  } catch (e) {
    console.error('POST /api/sessions', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ids = await getAllSessionIds()
    const sessions = await Promise.all(
      ids.map((id) => getSession(id))
    )
    const valid = sessions.filter(Boolean) as Session[]
    valid.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
    return NextResponse.json({ sessions: valid })
  } catch (e) {
    console.error('GET /api/sessions', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
