# Cuemath AI Tutor Screener

An AI-powered first-round screening tool for Cuemath tutor candidates. Candidates complete a fully voice-driven interview with an AI interviewer, receive a structured rubric-based evaluation, and the hiring team reviews everything through a password-protected admin dashboard.

Built for the **Cuemath AI Builder Challenge** — Problem 3: Tutor Hiring Tool.

---

## Demo flow

```
Landing page → Mic check → Fullscreen interview → AI evaluation → Candidate report
                                                              ↓
                                                     Admin dashboard
```

1. **Landing** — Candidate enters name, email, and current role
2. **Mic check** — 3-second test recording with instant playback and retry
3. **Interview** — Fullscreen, voice-driven session: AI asks 5 questions, VAD detects when the candidate finishes speaking, responses are transcribed and fed back to the LLM
4. **Evaluation** — After question 5, the full transcript is scored across 5 rubric dimensions using GPT-4o-mini tool calling
5. **Candidate report** — Softened results page with scores, strengths, and growth areas
6. **Admin dashboard** — Password-gated list of all sessions with full transcripts, rubric breakdowns, and session management

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| LLM — interviewer + evaluator | OpenAI `gpt-4o-mini` |
| Speech-to-text | OpenAI Whisper `whisper-1` |
| Text-to-speech | OpenAI TTS `tts-1` (browser `SpeechSynthesis` fallback) |
| Session storage | Upstash Redis |
| Deployment | Vercel |

---

## Features

### Interview experience
- **Fullscreen mode** — Interview launches in fullscreen on click; persistent banner prompts re-entry if the candidate exits
- **Voice Activity Detection** — Automatically stops recording after 1.5 s of silence; 15 s max-silence auto-submit
- **Echo cancellation** — `echoCancellation`, `noiseSuppression`, and `autoGainControl` applied to mic capture; prevents AI TTS bleed into transcription
- **Garbage filter** — Whisper hallucinations (non-Latin text, "thank you for watching"-style phrases) are filtered server-side before reaching the LLM
- **3-second countdown** — Visual countdown before the first question fires
- **Mute toggle** — Disables mic track in-stream without restarting recording
- **Audio device switching** — Select a different microphone mid-session from the collapsible audio panel
- **Submit early** — Candidate can tap Send to submit their answer before VAD silence timeout

### Integrity
- **Tab-switch detection** — Every time the candidate switches tabs, the event is logged (timestamp + duration hidden) and shown in the admin detail view
- **Focus warning toast** — First tab switch triggers a non-blocking toast reminder
- **Fullscreen exit warning** — Persistent top bar prompts re-entry if fullscreen is exited mid-interview

### AI interviewer
- **5 structured questions** — Fixed question set targeting communication, warmth, and teaching ability
- **Adaptive follow-ups** — Interviewer asks follow-ups, redirects, or clarification requests based on answer quality
- **Tool-enforced responses** — LLM uses `tool_choice: "required"` so every response is structured JSON with utterance, question index, utterance type, and completion flag

### Evaluation
- **5-dimension rubric** — Communication clarity, warmth, ability to simplify, patience, English fluency; each scored 1–5
- **Evidence quotes** — Every score is backed by a verbatim candidate quote; validated as a true substring of the transcript
- **Quote retry** — If validation fails, evaluation is retried once with a correction note; flagged `validated: false` if still invalid
- **Recommendation** — `advance` / `maybe` / `do_not_advance` with a written summary

### Admin dashboard
- **Session list** — All sessions with status, recommendation, tab-switch warning, and quote-validation flag
- **Session detail** — Full transcript, rubric breakdown with score bars, strengths/concerns, and raw JSON
- **Delete sessions** — Trash icon on each card + confirmation modal; permanently removes from Redis
- **Token auth** — All admin routes require `ADMIN_TOKEN`; verified server-side on every request

---

## Project structure

```
app/
  page.tsx                    # Landing page — name / email / role form
  mic-check/page.tsx          # Mic check with 3 s recording + playback
  interview/page.tsx          # Interview UI — fullscreen, orb, VAD, chat bubbles
  report/[sessionId]/         # Candidate-facing rubric report
  admin/
    page.tsx                  # Session list (password-gated, client component)
    [sessionId]/
      page.tsx                # Session detail — transcript + rubric
      DeleteButton.tsx        # Client delete button + confirmation modal

  api/
    sessions/route.ts         # POST create session · GET list (admin-only)
    sessions/[id]/route.ts    # GET · PUT (whitelisted fields) · DELETE (admin-only)
    interview/route.ts        # POST → GPT-4o-mini → persist AI turn
    transcribe/route.ts       # POST audio → Whisper → filtered text
    tts/route.ts              # POST text → OpenAI TTS → audio/mpeg
    evaluate/route.ts         # POST → GPT-4o-mini tool call → save rubric
    session/log-event/route.ts# POST tab-visibility events (capped at 200)

lib/
  claude.ts                   # getInterviewerResponse · evaluateInterview
  prompts.ts                  # INTERVIEWER_SYSTEM · EVALUATOR_SYSTEM
  redis.ts                    # getSession · saveSession · getAllSessionIds · deleteSession
  groq.ts                     # Whisper transcription (OpenAI client)
  elevenlabs.ts               # OpenAI TTS (replaces ElevenLabs)

types/index.ts                # TranscriptEntry · RubricResult · Session · FocusEvent
```

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/ayush1944/cuemath.git
cd cuemath
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
OPENAI_API_KEY=sk-...

UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

ADMIN_TOKEN=your-secure-password
```

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | Powers GPT-4o-mini (interviewer + evaluator) + Whisper STT + TTS |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis REST token |
| `ADMIN_TOKEN` | ✅ | Password for `/admin` — choose something non-trivial |

Get free-tier credentials:
- **OpenAI**: [platform.openai.com](https://platform.openai.com)
- **Upstash Redis**: [console.upstash.com](https://console.upstash.com)

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Vercel)

1. Push to GitHub (`.env.local` is already in `.gitignore`)
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add the four environment variables in **Project Settings → Environment Variables**
4. Deploy — Next.js is auto-detected

---

## Admin dashboard

Navigate to `/admin` and enter your `ADMIN_TOKEN`. You'll see all sessions with:

| Badge | Meaning |
|---|---|
| Completed / In Progress / Abandoned | Interview status |
| Advance / Maybe / Do Not Advance | LLM recommendation |
| ⚠ Tab switches | Candidate left the tab more than twice |
| Quote unvalidated | Evidence quotes couldn't be verified as verbatim |

Click any session to see the full transcript, per-dimension scores with score bars, strengths, concerns, and expandable raw JSON. Use the **Delete session** button to permanently remove a record.

---

## Interview rubric dimensions

| Dimension | What's measured |
|---|---|
| Communication Clarity | Clear, structured, easy-to-follow explanations |
| Warmth | Empathy, encouragement, positive tone toward students |
| Ability to Simplify | Breaking down complex ideas for young learners |
| Patience | Composure when students struggle or repeat mistakes |
| English Fluency | Grammar, vocabulary, natural expression |

Each dimension is scored 1–5 and backed by a verbatim quote from the candidate's answers.

---

## Known limitations

- No rate limiting on API routes — acceptable for a screener, essential before public use
- Full audio recording sent to Whisper after VAD silence — no real-time streaming
- No interruption handling — candidate cannot cut the AI off mid-sentence
- Mobile layout is functional but not optimised for small screens
- No Redis TTL — old sessions accumulate; add `EX` on `redis.set` for production cleanup

---

## License

MIT
