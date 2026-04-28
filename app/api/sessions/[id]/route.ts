import { NextResponse } from 'next/server'
import { getSession, saveSession } from '@/lib/redis'
import type { Session } from '@/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession(id)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ session })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const updates = await request.json() as Partial<Session>
    const existing = await getSession(id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Whitelist: only allow safe in-flight fields; never let a client overwrite id, rubric, or completed status
    const allowed: Partial<Session> = {}
    if (updates.currentQuestionIndex !== undefined) allowed.currentQuestionIndex = updates.currentQuestionIndex
    if (updates.lastUtteranceType !== undefined) allowed.lastUtteranceType = updates.lastUtteranceType
    if (updates.status === 'abandoned') allowed.status = 'abandoned'

    const updated: Session = { ...existing, ...allowed }
    await saveSession(updated)
    return NextResponse.json({ session: updated })
  } catch (e) {
    console.error('PUT /api/sessions/[id]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
