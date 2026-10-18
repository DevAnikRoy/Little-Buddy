# System design

English companion for children under seven. The product teaches in small steps, stops quizzing when the child needs play or support, and stays usable without an LLM.

Live app: [https://little-buddy-two.vercel.app](https://little-buddy-two.vercel.app)  
Source: [https://github.com/DevAnikRoy/Little-Buddy](https://github.com/DevAnikRoy/Little-Buddy)

## Goals

| Requirement | Design |
| --- | --- |
| Progressive L1–L3 | Six skills, 18 catalog activities, mastery gates, easier question after two wrong answers |
| Child mode | Rule-based Learning, Conversation, Engagement, Support (learning-state estimation, not emotion recognition) |
| SEL | Named feelings, effort praise, choices, trusted-grown-up line in Support |
| Context | Structured `mode` / `topic` / `disengagedTurns` plus saved skill counters and active activity |
| Latency | Provider abort at 1200 ms; rules path has no model wait. Warm deployed rules p50/p95: [latency.md](./latency.md) |
| Child safety | No PII collection, no accounts, Zod caps, output vocabulary gate, CSP |

## Non-goals

No database, user accounts, parent panel, certified emotion AI, free-form semantic grading, or always-on LLM. No promise of sub-two-second latency on every cold start or slow network.

## High-level shape

The UI is a client component. Each tap or submit sends the last saved progress blob and a small chat context to `POST /api/chat`. The server returns the next mode, reply, choices, progress, and optional activity. Only progress is written to `localStorage` (`little-buddy:progress:v1`). Transcripts stay in memory (30 messages).

Stack: Next.js App Router, TypeScript, Zod, Vitest, Vercel Node serverless, optional Groq `llama-3.1-8b-instant`.

## Progressive learning

Curriculum lives in `src/lib/learning/curriculum.ts`.

| Level | Skills | Example |
| --- | --- | --- |
| L1 | colors, animals | “What color is the apple?” |
| L2 | preferences, sentences | “I like cats.” |
| L3 | descriptions, stories | size + color; simple story feelings |

Checking is deterministic. Answers are normalized (case, punctuation, spacing) and matched to an explicit list. This is not an LLM grader, so a creative but correct sentence can be marked wrong. That is an intentional reliability trade-off for under-sevens.

Mastery of a skill requires:

- three distinct activities answered **without** a hint
- at least 75% independent-correct in the last five attempts (or all attempts if fewer than five)

Hinted success is practice. A wrong answer drops that activity from evidence. Current level is the earliest level with any unmastered skill. After all six skills, practice continues at L3; there is no L4.

Stuck handling: one wrong keeps the question; two consecutive wrongs pick an easier-level item; skip changes the question without a mastery penalty; start/reload restores the active item from storage.

`handleLearning` clones and validates state. Callers never see a mutated original.

## Mode detection

`detectMode` in `src/lib/chat/modes.ts` is ordered rules, not a classifier.

1. Explicit feeling / safety language → **Support** (even during a lesson), unless the text is the correct story answer.
2. Correct activity answer → **Learning**.
3. Tired / bored / stop → **Engagement**.
4. Learn / hint / skip / continue → **Learning**.
5. Play / game → **Engagement**.
6. Greetings / talk → **Conversation**.
7. Repeated “I don’t know” after a disengaged turn → **Engagement** instead of endless testing.
8. Short answers while a lesson is active stay in **Learning**.
9. Otherwise **Conversation**.

Context updates topic (`feelings`, `play`, `animals`, `books`, `general`) and a 0–3 `disengagedTurns` counter. The pretend game can stay in Engagement for hop/flap replies without storing a transcript.

## SEL

Support names the feeling, praises trying, offers a break or talk choice, and points to a trusted grown-up. Urgent phrases (`hurt me`, `not safe`, …) skip Groq and return a fixed grown-up-help line. Happy/Sad/Tired are first-class buttons so a child does not have to type affect. Engagement is a short pretend game, not another quiz.

## Optional LLM

Groq runs **only** for open-ended Conversation or Support after rules decide the turn is eligible. It never grades, picks the next activity, or advances mastery.

Constraints:

- Key is server-only (`GROQ_API_KEY`). No `NEXT_PUBLIC_` key.
- 1200 ms `AbortController` around fetch **and** body parse. No app-level retries.
- System prompt is fixed and receives only validated level/mode/topic. Child text is a separate user message.
- Output must pass `isSafeReply`: two short sentences, one question max, level word lists, no links or PII asks. Support also needs a trusted-grown-up phrase.
- Missing key, bad model env, network error, non-2xx, unsafe text, or timeout → deterministic `ruleReply`.

Without a key, production still teaches and supports. That is the default on the current Vercel project.

Eligible child text **is** sent to Groq when the key is set. That is third-party processing, not local-only storage. Keyword filters cannot catch every disclosure.

## Persistence and privacy

Saved JSON is versioned counters, evidence IDs, and bounded activity context. No free-text chat. Invalid, oversized, or unknown-version data resets in memory. Quota / blocked storage still lets the child play until reload. Reset removes only this app’s key. Browser-local progress is not a credential.

Session IDs are random UUIDs for rate limiting, not login.

## API and security

`POST /api/chat`:

- Node runtime, `Cache-Control: no-store`
- Body cap 16 KiB; messages 200 characters
- Same-origin (`Origin` vs `Host`) and JSON content-type
- Strict Zod request/response; activity payloads must match the catalog
- In-memory limiter: 60/min per IP, 30/min per session. IP hashed with a process salt. `x-forwarded-for` trusted only when `VERCEL=1`. Limits reset on cold start and are **not** shared across instances
- Headers: CSP, HSTS, `nosniff`, `DENY` framing, `no-referrer`, camera/mic/geo off

Application code does not log child messages, IPs, keys, or Groq error bodies.

The UI uses a request lock, 6 s client abort (separate from 1200 ms provider budget), Zod before save, and text-only rendering.

## Performance

| Layer | Bound | Meaning |
| --- | --- | --- |
| Rules path | no provider | Quiz, SEL templates, play script |
| Groq path | 1200 ms abort | Open-ended only; then fallback |
| Browser fetch | 6 s | Network recovery, not the product SLO |
| Serverless | cold start possible | First hit after idle can exceed 2 s |

The assessment asks for under 2 s under **normal** conditions. The design aims at that by keeping learning on rules and bounding the model. It does **not** claim every request, including cold starts or Groq turns, is under 2 s.

Measured on 18 Oct 2026 from Dhaka to production `iad1` (no Groq key): **warm rules POST p50 271 ms / p95 448 ms (n=60)**; first request in the run **1281 ms**. Full conditions: [latency.md](./latency.md).

## Testing

71 Vitest tests cover mastery, remediation, persistence, mode/SEL, safety, timeout/fallback (mocked fetch + fake timers), rate limits, and route origin/body rules. `npm run typecheck` and `npm run build` are part of the gate.

A live keyed Groq call is still unverified on production because no `GROQ_API_KEY` is configured.

## Trade-offs

| Choice | Why | Cost |
| --- | --- | --- |
| Rules own learning | Predictable, fast, testable for under-7s | No semantic grading |
| LLM only for chat/support | Latency and safety budget | Weaker open-ended talk without a key |
| localStorage | No PII store, no accounts, works offline for progress | Device-local, editable, not multi-device |
| Keyword mode + SEL | Honest about limits; interruptible lessons | Misses subtle mood |
| In-memory rate limit | Fits Hobby serverless | Weak under multi-instance abuse |
| Short replies + vocab gate | Age-appropriate, safer | Stiff LLM voice |
| Browser speech | No extra vendor | Voice quality depends on OS |

## Mapping to the brief

1. **Progressive learning** — L1–L3 skills and mastery in `engine.ts`.  
2. **Child mode** — four modes; the bot does not quiz on every turn.  
3. **SEL** — feelings, effort, break, trusted adult.  
4. **Context** — progress + structured chat context on every request.  
5. **Performance** — 1200 ms provider cap; warm rules p50/p95 in [latency.md](./latency.md).  
6. **Deliverables** — live URL, GitHub, this design, [architecture](./architecture.md), README; video next.
