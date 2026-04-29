# Cuemath AI Tutor Screener

> An AI-powered first-round screening interviewer for Cuemath tutor candidates.
> Voice-based · 5 questions · structured rubric output · admin dashboard.

🔗 **Live demo:** https://cuemath-sage.vercel.app
🎥 **Video walkthrough:** [your URL]
📄 **Project write-up:** [your Google Doc URL]

---

## What it does

Cuemath receives thousands of tutor applications. The first-round screen — "can this person actually explain things clearly, warmly, in English?" — is repetitive, expensive, and inconsistent when done by humans at scale.

This tool replaces that screen with a voice-driven AI interview. A candidate visits a link, speaks their answers to 5 structured questions, and walks away with a results page. The hiring team opens a dashboard, sees every candidate scored across 5 rubric dimensions, with verbatim evidence quotes from the transcript, and makes a fast call: Advance / Maybe / Do Not Advance.

No scheduling. No interviewer time. Consistent bar across every candidate.

---

## Tech stack

Next.js 16 · TypeScript · Tailwind CSS v4 · OpenAI GPT-4o-mini · OpenAI Whisper · OpenAI TTS · Upstash Redis · Vercel

---

## Run locally

```bash
git clone https://github.com/ayush1944/cuemath.git
cd cuemath
npm install
cp .env.example .env.local
# Fill in: OPENAI_API_KEY, UPSTASH_REDIS_REST_URL,
#          UPSTASH_REDIS_REST_TOKEN, ADMIN_TOKEN
npm run dev
```

---

## Architecture

```
Browser                          Server (Next.js API routes)         External
───────                          ───────────────────────────         ────────
Landing page
  └─ POST /api/sessions ──────────────────────────────────────── Upstash Redis
                                                                  (store session)
Mic check
  └─ getUserMedia()

Interview page (fullscreen)
  ├─ VAD detects silence
  ├─ POST /api/transcribe ─────────────────────────────────────── OpenAI Whisper
  │    └─ garbage filter (non-Latin, hallucination phrases)
  ├─ POST /api/interview ──────────────────────────────────────── GPT-4o-mini
  │    └─ tool_choice: required → structured JSON response         (interviewer)
  └─ POST /api/tts ────────────────────────────────────────────── OpenAI TTS
       └─ audio/mpeg → <Audio> playback

After question 5:
  POST /api/evaluate ──────────────────────────────────────────── GPT-4o-mini
    └─ 5-dimension rubric + evidence quotes                        (evaluator)
         └─ quote validation (verbatim substring check)
              └─ retry once if invalid
                   └─ save to Redis → redirect to /report

Admin at /admin
  └─ GET /api/sessions?token=... → all sessions
  └─ DELETE /api/sessions/[id]?token=... → remove session
```

The interviewer and evaluator are separate LLM calls with separate system prompts. The interviewer uses `tool_choice: required` to enforce structured output (utterance, question index, utterance type, completion flag) on every turn — no free-form generation that could break the state machine.

Echo cancellation (`echoCancellation: true, noiseSuppression: true, autoGainControl: true`) is applied to the mic stream so the AI's own TTS output doesn't bleed into the next recording. A 300ms gap is inserted between TTS end and mic start to absorb reverb. Whisper hallucinations (Japanese/Chinese YouTube phrases, "thanks for watching") are filtered server-side before reaching the LLM.

---

## Project write-up

### 1. The problem

Cuemath's tutor hiring funnel has a specific first-round problem: they need to know whether a candidate can explain things clearly, speak warm English, and show patience — before investing recruiter time in a real interview. That screen is currently done by humans at a high volume, with inevitable inconsistency in how different interviewers weight different qualities.

The brief asked for an AI tool that could automate this screen. The constraint that made it interesting: the screen is inherently conversational. A form doesn't tell you if someone is warm. A written response doesn't tell you how they sound.

### 2. The approach

Voice-first. The candidate should feel like they're having a conversation, not filling out a form. That meant:

- Text-to-speech for the AI's questions (not text on a screen)
- Speech-to-text for the candidate's answers (not a text box)
- Voice activity detection so the candidate doesn't have to press a button — they just... stop talking

The 5 questions are fixed and sequenced: intro → teaching approach → handling a struggling student → explaining a concept simply → why Cuemath specifically. Each question has a rubric-relevant intent. The LLM interviewer can ask follow-ups, redirect vague answers, or request clarification — but it always advances after sufficient engagement.

The evaluator is a separate LLM call that receives the full transcript after question 5 and scores it across 5 dimensions with verbatim evidence quotes. Every quote is validated as a true substring of what the candidate actually said — preventing hallucinated or paraphrased evidence.

### 3. Technical decisions

**OpenAI for everything.** The initial build used Groq (Llama 3.3) for the LLM and Whisper, with ElevenLabs for TTS. Llama's tool-calling was unreliable — it would misspell function names (`spreak` instead of `speak`), emit duplicate JSON keys, and require fragile salvage code. Switching to GPT-4o-mini eliminated all of that. OpenAI Whisper replaced Groq Whisper, and OpenAI TTS replaced ElevenLabs when the free-tier quota ran out. One API key, one dependency.

**Tool use for structured output.** Both the interviewer and evaluator use `tool_choice: "required"` — the model must call a function on every turn. This enforces a strict schema and makes the state machine deterministic. No regex parsing of free-form text.

**Fullscreen interview.** The browser Fullscreen API is called on the user gesture that starts the interview — the only moment browsers allow it. If the candidate exits fullscreen (Escape key), a persistent top banner prompts them to return. Combined with tab-switch logging (every hide/show event is timestamped and stored), the admin can see integrity signals alongside the rubric.

**Echo cancellation.** Without `echoCancellation: true` in `getUserMedia`, the mic picks up the AI's TTS output through speakers. Whisper then transcribes it — often as Japanese or Chinese text (a known Whisper hallucination pattern on certain audio). A server-side garbage filter catches anything with >30% non-ASCII characters or known hallucination phrases as a second line of defence.

**Upstash Redis.** Sessions are stored as JSON blobs under `session:{id}` with a set `sessions` tracking all IDs. Simple, serverless-compatible, and fast enough for a screener with no concurrent-write hotspots.

### 4. Challenges

**VAD reliability.** Getting the silence detection thresholds right took iteration. Too sensitive and it cuts off candidates mid-thought. Too loose and the interview hangs. The final values (RMS threshold 0.015, 1.5 s silence, 15 s max) work well for typical laptop/phone mic setups.

**LLM tool-call reliability.** Llama 3.3 on Groq required three layers of salvage code to handle malformed tool calls. The switch to GPT-4o-mini removed that entirely. Sometimes the right fix is a better tool, not more defensive code.

**Whisper hallucinations.** When the mic is quiet, Whisper doesn't return silence — it returns plausible-sounding text in whatever language its prior makes most likely. In some environments this manifested as Japanese subtitles. The fix was two-pronged: browser echo cancellation (prevent the audio source) and server-side filtering (catch anything that slips through).

**Evaluation quote validation.** GPT-4o-mini occasionally paraphrases evidence quotes rather than quoting verbatim. The validator checks every quote as a case-insensitive substring of the transcript and triggers a single retry with a correction note. Quotes that still fail are flagged `validated: false` in the admin UI so reviewers know to weight the evidence less.

### 5. Results

A complete interview — 5 questions, natural follow-ups, full evaluation — runs in about 12–15 minutes end-to-end. The rubric output is consistent across sessions. The admin dashboard makes it easy to compare candidates side by side and spot integrity signals (tab switches, unvalidated quotes) without reading full transcripts unless needed.

The candidate-facing report is intentionally softened: it shows scores and growth areas but doesn't display the raw `advance / do_not_advance` flag. Candidates leave with actionable feedback regardless of outcome.

### 6. What's next

- **Streaming transcription** — Send audio chunks in real time instead of waiting for VAD silence; reduces perceived latency
- **Interruption handling** — Let the candidate cut the AI off mid-sentence
- **Rate limiting** — Essential before any public rollout
- **Session TTL** — Add Redis `EX` on session writes so old data doesn't accumulate indefinitely
- **Mobile optimisation** — The interview UI is functional on mobile but not polished
- **Custom question sets** — Allow hiring managers to configure questions per role from the admin panel

---

## Admin dashboard

Navigate to `/admin` and enter your `ADMIN_TOKEN`. Every session shows:

| Signal | Meaning |
|---|---|
| Advance / Maybe / Do Not Advance | LLM recommendation |
| ⚠ Tab switches | Candidate left the tab more than twice during the interview |
| Quote unvalidated | Evidence quotes couldn't be verified as verbatim substrings |

Click any session for the full transcript, per-dimension scores, strengths, concerns, and expandable raw JSON. The delete button (trash icon, hover to reveal) permanently removes a session after confirmation.

---

## License

MIT
