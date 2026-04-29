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

export async function deleteSession(id: string): Promise<void> {
  await redis.del(`session:${id}`)
  await redis.srem('sessions', id)
}
