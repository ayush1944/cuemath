'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', role: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      setError('Please fill in your name and email.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName: form.name.trim(),
          candidateEmail: form.email.trim(),
          candidateRole: form.role.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/mic-check?session=${data.sessionId}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #FAFAF8 0%, #FFF7ED 100%)' }}>

      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ background: 'linear-gradient(135deg, #F97316, #ef4444)' }}>
            C
          </div>
          <span className="text-2xl font-semibold text-gray-800">Cuemath</span>
        </div>
        <p className="text-gray-400 text-sm">Tutor Screening Interview</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Welcome, future tutor
        </h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          You&apos;ll have a short voice conversation with our AI interviewer — about 5 questions, 10 minutes.
          No math knowledge tested; just a conversation about how you teach.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full name <span className="text-orange-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Priya Sharma"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
              style={{ ['--tw-ring-color' as string]: '#FDBA74' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address <span className="text-orange-400">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="priya@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Current role{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="Teacher, tutor, student..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-60 mt-2"
            style={{ background: 'linear-gradient(135deg, #F97316, #ef4444)' }}
          >
            {loading ? 'Starting...' : 'Begin interview →'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Make sure your microphone is available before you begin.
        </p>
      </div>
    </main>
  )
}
