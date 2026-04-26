import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/redis'
import type { DimensionScore } from '@/types'

const DIMENSION_LABELS: Record<string, string> = {
  communication_clarity: 'Communication Clarity',
  warmth: 'Warmth',
  ability_to_simplify: 'Ability to Simplify',
  patience: 'Patience',
  english_fluency: 'English Fluency',
}

function ScoreDots({ score }: { score: number }) {
  return (
    <span className="inline-flex gap-1 ml-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="inline-block w-3 h-3 rounded-full"
          style={{ background: i <= score ? '#F97316' : '#e5e7eb' }} />
      ))}
    </span>
  )
}

export default async function AdminSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { sessionId } = await params
  const { token } = await searchParams

  if (token !== process.env.ADMIN_TOKEN) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Unauthorized.</p>
      </main>
    )
  }

  const session = await getSession(sessionId)
  if (!session) notFound()

  const backUrl = `/admin?token=${encodeURIComponent(token ?? '')}`

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: '#FAFAF8' }}>
      <div className="max-w-3xl mx-auto">
        <Link href={backUrl} className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">
          ← Back to all sessions
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">{session.candidateName}</h1>
          <p className="text-gray-500 text-sm">{session.candidateEmail} · {session.candidateRole || 'role not specified'}</p>
          <p className="text-xs text-gray-400 mt-1">
            Started: {new Date(session.startedAt).toLocaleString()}
            {session.completedAt && ` · Completed: ${new Date(session.completedAt).toLocaleString()}`}
          </p>
          <div className="mt-2">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              session.status === 'completed' ? 'bg-green-50 text-green-700' :
              session.status === 'in_progress' ? 'bg-amber-50 text-amber-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {session.status}
            </span>
            {session.rubric && !session.rubric.validated && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                ⚠ Quote validation failed
              </span>
            )}
          </div>
        </div>

        {/* Rubric */}
        {session.rubric ? (
          <div className="space-y-4 mb-6">
            <h2 className="text-base font-semibold text-gray-800">Rubric</h2>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="font-semibold text-gray-800 mb-1">
                Recommendation:{' '}
                <span className="uppercase tracking-wide text-sm"
                  style={{ color: session.rubric.overall_recommendation === 'advance' ? '#15803d' : session.rubric.overall_recommendation === 'maybe' ? '#92400e' : '#374151' }}>
                  {session.rubric.overall_recommendation.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="text-sm text-gray-600">{session.rubric.overall_summary}</p>
            </div>

            {Object.entries(session.rubric.dimensions).map(([key, dim]) => (
              <div key={key} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-800 text-sm">{DIMENSION_LABELS[key]}</h3>
                  <span className="text-sm font-bold text-orange-500">{(dim as DimensionScore).score}/5</span>
                  <ScoreDots score={(dim as DimensionScore).score} />
                </div>
                <p className="text-sm text-gray-600 mb-2">{(dim as DimensionScore).justification}</p>
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 font-mono">
                  &quot;{(dim as DimensionScore).evidence_quote}&quot;
                </p>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-700 text-sm mb-2">Strengths</h3>
                <ul className="space-y-1">
                  {session.rubric.strengths.map((s, i) => <li key={i} className="text-sm text-gray-600">· {s}</li>)}
                </ul>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-700 text-sm mb-2">Concerns</h3>
                <ul className="space-y-1">
                  {session.rubric.concerns.map((c, i) => <li key={i} className="text-sm text-gray-600">· {c}</li>)}
                </ul>
              </div>
            </div>

            {/* Raw JSON */}
            <details className="bg-white rounded-xl border border-gray-100 p-4">
              <summary className="cursor-pointer text-sm text-gray-500 select-none">Raw rubric JSON</summary>
              <pre className="mt-3 text-xs text-gray-500 overflow-auto max-h-96 bg-gray-50 rounded-lg p-3">
                {JSON.stringify(session.rubric, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-amber-700 text-sm">No rubric yet — interview may be incomplete.</p>
          </div>
        )}

        {/* Full transcript */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Full transcript</h2>
          <div className="space-y-3">
            {session.transcript.map((entry, i) => (
              <div key={i} className={`flex ${entry.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-lg px-4 py-2.5 rounded-2xl text-sm ${
                  entry.role === 'ai' ? 'bg-purple-50 text-purple-900' : 'bg-orange-50 text-orange-900'
                }`}>
                  <p className="text-xs opacity-50 mb-1">{entry.role === 'ai' ? 'AI' : 'Candidate'}</p>
                  {entry.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
