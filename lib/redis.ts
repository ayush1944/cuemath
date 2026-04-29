import { Redis } from '@upstash/redis'
import type { Session } from '@/types'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function getSession(id: string): Promise<Session | null> {
  return redis.get<Session>(`session:${id}`)
}

export async function saveSession(session: Session): Promise<void> {
  await redis.set(`session:${session.id}`, session)
  await redis.sadd('sessions', session.id)
}

export async function getAllSessionIds(): Promise<string[]> {
  return redis.smembers('sessions')
}

// Fetches all sessions in two round-trips (smembers + mget) instead of N+1
export async function getAllSessions(): Promise<Session[]> {
  const ids = await redis.smembers('sessions')
  if (ids.length === 0) return []
  const values = await redis.mget<Session[]>(...ids.map(id => `session:${id}`))
  return values.filter((v): v is Session => v !== null)
}

export async function deleteSession(id: string): Promise<void> {
  await redis.del(`session:${id}`)
  await redis.srem('sessions', id)
}
