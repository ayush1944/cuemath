'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Session } from '@/types'

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completed', color: '#15803d' },
  in_progress: { label: 'In Progress', color: '#92400e' },
  abandoned: { label: 'Abandoned', color: '#6b7280' },
}

const REC_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  advance: { label: 'Advance', bg: '#f0fdf4', color: '#15803d' },
  maybe: { label: 'Maybe', bg: '#fffbeb', color: '#92400e' },
  do_not_advance: { label: 'Do Not Advance', bg: '#f9fafb', color: '#374151' },
}

async function fetchSessionsFromApi(t: string): Promise<Session[] | null> {
  const res = await fetch(`/api/sessions?token=${encodeURIComponent(t)}`)
  if (res.status === 401) return null
  const { sessions } = await res.json()
  return sessions as Session[]
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : ''
  )
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(() =>
    typeof window !== 'undefined' ? !!sessionStorage.getItem('admin_token') : false
  )
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_token')
    if (!saved) return
    fetchSessionsFromApi(saved).then((data) => {
      if (data === null) {
        sessionStorage.removeItem('admin_token')
        setToken('')
      } else {
        setSessions(data)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const data = await fetchSessionsFromApi(password).catch(() => null)
    if (data === null) {
      setError('Wrong password.')
      setLoading(false)
      return
    }
    setSessions(data)
    setToken(password)
    sessionStorage.setItem('admin_token', password)
    setLoading(false)
  }

  function handleSignOut() {
    sessionStorage.removeItem('admin_token')
    setToken('')
    setSessions([])
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/sessions/${deleteTarget.id}?token=${encodeURIComponent(token)}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== deleteTarget.id))
        setDeleteTarget(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#FAFAF8' }}>
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-6">Admin access</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #F97316, #ef4444)' }}>
              {loading ? 'Checking...' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: '#FAFAF8' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #F97316, #ef4444)' }}>C</div>
            <span className="font-semibold text-gray-700">Cuemath — Admin</span>
          </div>
          <button onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-gray-600 transition">
            Sign out
          </button>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">All sessions</h1>
        <p className="text-gray-500 text-sm mb-6">{sessions.length} total</p>

        {loading && <p className="text-gray-400">Loading...</p>}

        <div className="space-y-3">
          {sessions.map((s) => {
            const rec = s.rubric ? REC_BADGE[s.rubric.overall_recommendation] : null
            const status = STATUS_BADGE[s.status]
            return (
              <div key={s.id} className="relative group">
                <Link href={`/admin/${s.id}?token=${encodeURIComponent(token)}`}
                  className="block bg-white rounded-xl border border-gray-100 p-5 hover:border-orange-200 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{s.candidateName}</p>
                      <p className="text-sm text-gray-400">{s.candidateEmail} · {s.candidateRole || 'role not specified'}</p>
                      <p className="text-xs text-gray-300 mt-0.5">
                        {new Date(s.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(s.focus_events ?? []).filter(e => e.event === 'tab_hidden').length > 2 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          ⚠ Tab switches
                        </span>
                      )}
                      {s.rubric && !s.rubric.validated && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                          Quote unvalidated
                        </span>
                      )}
                      {rec && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold"
                          style={{ background: rec.bg, color: rec.color }}>
                          {rec.label}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={{ color: status.color, borderColor: status.color + '44', background: status.color + '11' }}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Delete button — appears on hover */}
                <button
                  onClick={(e) => { e.preventDefault(); setDeleteTarget(s) }}
                  title="Delete session"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          onClick={() => !deleting && setDeleteTarget(null)}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">Delete session?</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              This will permanently delete <strong className="text-gray-700">{deleteTarget.candidateName}</strong>&apos;s interview session. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
