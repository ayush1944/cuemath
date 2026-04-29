import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/redis'
import type { DimensionScore } from '@/types'
import DeleteButton from './DeleteButton'

const DIMENSION_LABELS: Record<string, string> = {
  communication_clarity: 'Communication Clarity',
  warmth: 'Warmth',
  ability_to_simplify: 'Ability to Simplify',
  patience: 'Patience',
  english_fluency: 'English Fluency',
}

const REC_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  advance:        { label: 'Advance',         color: '#15803d', bg: '#f0fdf4' },
  maybe:          { label: 'Maybe',           color: '#92400e', bg: '#fffbeb' },
  do_not_advance: { label: 'Do Not Advance',  color: '#374151', bg: '#f3f4f6' },
}

function ScoreBar({ score }: { score: number }) {
  const fill =
    score >= 5 ? '#ea580c' :
    score === 4 ? '#f97316' :
    score === 3 ? '#fb923c' :
    score === 2 ? '#fdba74' : '#fed7aa'
  return (
    <div style={{ height: 6, background: '#ffedd5', borderRadius: 99, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', borderRadius: 99, background: fill, width: `${(score / 5) * 100}%` }} />
    </div>
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
  const rubric = session.rubric
  const strengths = rubric?.strengths ?? []
  const concerns = rubric?.concerns ?? []

  const dims = rubric ? Object.values(rubric.dimensions) : []
  const avgScore = dims.length
    ? Math.round((dims.reduce((s, d) => s + d.score, 0) / dims.length) * 10) / 10
    : null

  // Tab-switch stats
  const focusEvents = session.focus_events ?? []
  const switchCount = focusEvents.filter(e => e.event === 'tab_hidden').length
  const totalHiddenMs = focusEvents
    .filter(e => e.event === 'tab_visible')
    .reduce((sum, e) => sum + (e.hidden_duration_ms ?? 0), 0)
  const totalHiddenSecs = Math.round(totalHiddenMs / 1000)

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: '#FAFAF8' }}>
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <Link href={backUrl} className="text-sm text-gray-400 hover:text-gray-600 transition">
            ← Back to all sessions
          </Link>
          <DeleteButton sessionId={sessionId} token={token ?? ''} candidateName={session.candidateName} />
        </div>

        {/* Candidate card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{session.candidateName}</h1>
              <p className="text-gray-400 text-sm mt-0.5">{session.candidateEmail} · {session.candidateRole || 'role not specified'}</p>
              <p className="text-xs text-gray-300 mt-1">
                Started {new Date(session.startedAt).toLocaleString()}
                {session.completedAt && ` · Completed ${new Date(session.completedAt).toLocaleString()}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                session.status === 'completed' ? 'bg-green-50 text-green-700' :
                session.status === 'in_progress' ? 'bg-amber-50 text-amber-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                {session.status.replace('_', ' ')}
              </span>
              {rubric && !rubric.validated && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                  ⚠ Quote unvalidated
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab-switch warning */}
        {switchCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-center gap-3">
            <span className="text-amber-500 text-lg">⚠</span>
            <p className="text-sm text-amber-800">
              <strong>Tab switches during interview:</strong>{' '}
              {switchCount} switch{switchCount !== 1 ? 'es' : ''}
              {totalHiddenSecs > 0 && ` · ${totalHiddenSecs}s total hidden`}
            </p>
          </div>
        )}

        {/* Rubric */}
        {rubric ? (
          <div className="space-y-4 mb-6">

            {/* Recommendation + summary */}
            {(() => {
              const rec = REC_CONFIG[rubric.overall_recommendation]
              return (
                <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Recommendation</p>
                    <p className="font-bold text-lg" style={{ color: rec.color }}>{rec.label}</p>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{rubric.overall_summary}</p>
                  </div>
                  {avgScore !== null && (
                    <div className="text-center shrink-0 px-4 py-2 rounded-xl" style={{ background: rec.bg }}>
                      <div className="text-2xl font-bold" style={{ color: rec.color }}>{avgScore}</div>
                      <div className="text-xs text-gray-400">avg / 5</div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Dimension scores */}
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1">Dimension scores</h2>
            {Object.entries(rubric.dimensions).map(([key, dim]) => {
              const d = dim as DimensionScore
              const hasQuote = d.evidence_quote && d.evidence_quote !== 'insufficient_evidence_to_assess'
              return (
                <div key={key} className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-800 text-sm flex-1">{DIMENSION_LABELS[key]}</h3>
                    <span className="text-sm font-bold" style={{ color: '#f97316' }}>{d.score}<span className="text-gray-300 font-normal">/5</span></span>
                    <ScoreBar score={d.score} />
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{d.justification}</p>
                  {hasQuote && (
                    <p className="mt-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 italic leading-relaxed">
                      &ldquo;{d.evidence_quote}&rdquo;
                    </p>
                  )}
                </div>
              )
            })}

            {/* Strengths + Concerns */}
            {(strengths.length > 0 || concerns.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                {strengths.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h3 className="font-semibold text-gray-700 text-sm mb-2">Strengths</h3>
                    <ul className="space-y-1.5">
                      {strengths.map((s, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                          <span className="text-green-500 shrink-0 mt-0.5">✓</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {concerns.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h3 className="font-semibold text-gray-700 text-sm mb-2">Concerns</h3>
                    <ul className="space-y-1.5">
                      {concerns.map((c, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                          <span className="text-amber-500 shrink-0 mt-0.5">·</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Raw JSON */}
            <details className="bg-white rounded-xl border border-gray-100 p-4">
              <summary className="cursor-pointer text-sm text-gray-400 select-none hover:text-gray-600 transition">Raw rubric JSON</summary>
              <pre className="mt-3 text-xs text-gray-500 overflow-auto max-h-96 bg-gray-50 rounded-lg p-3 leading-relaxed">
                {JSON.stringify(rubric, null, 2)}
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
          <h2 className="text-sm font-semibold text-gray-800 mb-4">
            Full transcript
            <span className="ml-2 text-xs font-normal text-gray-400">{session.transcript.length} messages</span>
          </h2>
          {session.transcript.length === 0 ? (
            <p className="text-sm text-gray-400">No transcript recorded.</p>
          ) : (
            <div className="space-y-3">
              {session.transcript.map((entry, i) => (
                <div key={i} className={`flex ${entry.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-lg px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    entry.role === 'ai' ? 'bg-gray-50 text-gray-700' : 'bg-orange-50 text-orange-900'
                  }`}>
                    <p className="text-xs font-semibold opacity-40 mb-1">{entry.role === 'ai' ? 'Interviewer' : 'Candidate'}</p>
                    {entry.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
