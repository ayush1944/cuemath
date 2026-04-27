# Cuemath AI Tutor Screener

An AI-powered first-round screening tool for Cuemath tutor candidates. Candidates complete a fully voice-driven interview with an AI interviewer, receive a structured rubric-based evaluation, and the hiring team reviews everything through a password-protected admin dashboard.

Built for the **Cuemath AI Builder Challenge** (Problem 3 — Tutor Hiring Tool).

---

## What it does

1. **Landing page** — Candidate enters their name, email, and current role
2. **Mic check** — 3-second test recording with playback and retry
3. **Voice interview** — 5 fixed questions delivered by an AI interviewer via text-to-speech; candidate answers by speaking; VAD (voice activity detection) auto-detects when they finish
4. **Evaluation** — After question 5, the transcript is scored across 5 dimensions using a structured rubric with tool use
5. **Candidate report** — Softened, candidate-facing results with score dots and a recommendation banner
6. **Admin dashboard** — Password-gated list of all sessions with status badges, recommendation badges, full transcripts, and raw rubric JSON

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| LLM (interviewer + evaluator) | Groq — `llama-3.3-70b-versatile` |
| Speech-to-text | Groq Whisper (`whisper-large-v3-turbo`) |
| Text-to-speech | ElevenLabs (optional) with browser `SpeechSynthesis` fallback |
| Session storage | Upstash Redis |
| Deployment | Vercel |

---

## Features

- **Voice Activity Detection** — Automatically stops recording after 1.5 s of silence; 15 s max silence before auto-submit
- **Follow-up logic** — Interviewer asks one follow-up if an answer is under 15 words, vague, or invites elaboration
- **Structured evaluation** — 5 dimensions scored 1–5 (communication clarity, warmth, ability to simplify, patience, English fluency) via Groq tool use
- **Quote validation** — Every evidence quote must be a verbatim substring of what the candidate said; retried once on failure; flagged `validated: false` if still invalid
- **Mute toggle** — Disables mic track in-stream without restarting recording
- **Audio device switching** — Select a different microphone mid-session from the audio settings panel
- **3-second countdown** — Brief pre-interview window before the first question fires
- **End confirmation modal** — Prevents accidental exits mid-interview
- **LIVE indicator** — Green badge in the header while the interview is actively running
- **Admin token auth** — All admin routes require `ADMIN_TOKEN`; token is never exposed to the browser beyond sessionStorage

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/cuemath-ai-screener.git
cd cuemath-ai-screener
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq API key — used for LLM and Whisper STT |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis REST token |
| `ADMIN_TOKEN` | ✅ | Password for the `/admin` dashboard — use something non-trivial |
| `ELEVENLABS_API_KEY` | ❌ | Optional — falls back to browser TTS if not set |
| `ELEVENLABS_VOICE_ID` | ❌ | Optional — only used if `ELEVENLABS_API_KEY` is set |

Get free-tier credentials:
- **Groq**: [console.groq.com](https://console.groq.com)
- **Upstash Redis**: [console.upstash.com](https://console.upstash.com)

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
app/
  page.tsx                  # Landing page (name / email / role form)
  mic-check/page.tsx        # 3-second mic check with playback
  interview/page.tsx        # Main interview UI (VAD, orb, chat bubbles)
  report/[sessionId]/       # Candidate-facing rubric report
  admin/
    page.tsx                # Session list (password-gated)
    [sessionId]/page.tsx    # Full transcript + rubric detail

  api/
    sessions/route.ts       # POST create session, GET list (admin)
    sessions/[id]/route.ts  # GET / PUT individual session
    interview/route.ts      # POST → LLM → persist AI turn
    transcribe/route.ts     # POST audio → Groq Whisper → text
    tts/route.ts            # POST text → ElevenLabs or browser fallback
    evaluate/route.ts       # POST → evaluateInterview → save rubric

lib/
  claude.ts                 # LLM calls: getInterviewerResponse, evaluateInterview
  prompts.ts                # INTERVIEWER_SYSTEM, EVALUATOR_SYSTEM
  redis.ts                  # getSession, saveSession, getAllSessionIds
  groq.ts                   # Whisper transcription helper
  elevenlabs.ts             # ElevenLabs TTS helper

types/index.ts              # TranscriptEntry, RubricResult, Session
```

---

## Interview flow

```
Landing → Mic check → Interview (loading → countdown → ai_speaking ↔ listening → processing) → Evaluating → Report
```

The interviewer and evaluator both use `llama-3.3-70b-versatile` on Groq. The interviewer detects the `[INTERVIEW_COMPLETE]` token to trigger evaluation. The evaluator uses Groq's tool use API to return a structured JSON rubric.

---

## Admin dashboard

Navigate to `/admin` and enter the `ADMIN_TOKEN` value. You'll see all sessions sorted by start time, with:
- Status badge (In Progress / Completed / Abandoned)
- Recommendation badge (Advance / Maybe / Do Not Advance)
- "Quote unvalidated" warning if evidence quotes failed verbatim verification
- Full transcript and expandable raw JSON on the detail page

---

## Deployment (Vercel)

1. Push to GitHub (ensure `.env.local` is in `.gitignore` — it is)
2. Import the repo on [vercel.com](https://vercel.com)
3. Add the four required environment variables in Project Settings → Environment Variables
4. Deploy — Next.js and the framework preset are auto-detected

---

## Known limitations / what I'd improve

- No rate limiting on API routes — acceptable for a screener demo, essential for production
- No real-time audio streaming — full recording is sent to Whisper after VAD silence
- No interruption handling — candidate can't cut the AI off mid-sentence
- Mobile layout is functional but not optimised
- Session cleanup / TTL not implemented in Redis

---

## License

MIT
