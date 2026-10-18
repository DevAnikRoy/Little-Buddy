# Little Buddy

English learning chatbot for children under seven. Current phase: learning engine, localStorage adapter, four-mode chat service, optional Groq, and protected server API complete and tested. Chat UI and deployment are pending subsequent approved phases. The foundation page is not yet connected to the engine.

## Local setup
Requires Node.js 22+ and npm.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. The Groq key is optional, server-only, and not used by this foundation page.

## Checks
```sh
npm test
npm run typecheck
npm run build
```
68 Vitest tests cover progression, context, persistence, mode estimation, SEL, input/output safety, provider fallback/timeouts, rate limiting, and API boundaries. TypeScript check and production build pass.

## Deployment
Import this repository into Vercel with the Next.js framework preset and build command `npm run build`. Add optional GROQ_API_KEY and GROQ_MODEL environment variables on the server. The included vercel.json selects Next.js. Live deployment, complete flow checks and latency benchmarks are pending.

## Scope and limitations
Rules now control L1-L3, skill mastery, activities, checking, and learning context. Four-mode detection and SEL now run in the chat service. Optional Groq is limited to open-ended Conversation/Support replies with a 1200 ms timeout and safe fallback. Progress stays in localStorage, with no database, accounts or personal information collection. No parent panel, read-aloud or complex animations.

Provider timeout alone cannot guarantee total response latency. Deployed end-to-end p50/p95 and conditions will be reported after benchmarking. Serverless cold starts and rate-limiter limitations must be documented honestly.


## Learning engine (phase 2)

Source: `src/lib/learning/`. There are 18 activities across six skills: colors/animals (L1), preferences/sentences (L2), descriptions/stories (L3). Choice-based questions and explicitly accepted text variants are checked deterministically, with case, spacing and punctuation normalization. This is not general semantic grading.

A skill is mastered after three distinct activities are answered without hints and at least 75% of the last five attempts (or all attempts if fewer than five) are independently correct. Hinted success counts as practice, not independent mastery. Wrong answers remove that activity's mastery evidence. The current level is the earliest level with any unmastered skill. At L3 completion, practice continues without inventing an L4.

One wrong answer keeps the current question. Two consecutive wrong answers select a question from the previous level (or a different L1 question). A successful easier attempt returns to the current learning level. Skipping changes the question without penalizing mastery. A start/resume action retains the active question, even across page reloads after saving.

`handleLearning(state, action)` validates and returns a new state without mutating the caller. Actions are start, answer, hint, and skip. `learningSummary` provides current level and mastered skill count for the future UI.

The localStorage adapter saves only versioned skill counters, evidence IDs, and bounded activity context under `little-buddy:progress:v1`. It stores no free-text messages or conversation transcripts. Stored data is schema-validated; malformed, oversized, and unsupported-version data resets safely in memory. Blocked storage or quota errors return a status so the UI can continue in memory. Reset removes only Little Buddy's key. Browser-local progress can be edited or cleared by the device user; it is not a trusted credential or certified achievement.

Phase 2 verification: 19/19 unit tests, TypeScript check, and production build passed. Browser/UI integration verification is pending phase 4.


## Chat service and security (phase 3)

`POST /api/chat` accepts a random UUID sessionId, action (`start`, `message`, `hint`, `skip`, `learn`, `talk`, `play`, `break`), validated progress, and a small structured context (`mode`, `topic`, `disengagedTurns`). Only the message action includes message text. A reply returns mode, reply, choices, progress, context, optional activity, source, and outcome. The UI will keep chat text and mode context in memory; only learning progress is saved to localStorage. JSON responses have `Cache-Control: no-store`.

Rules estimate Learning, Conversation, Engagement, or Support. This is learning-state estimation, not precise emotion recognition. Personal feelings interrupt lessons; correct answers to story questions remain learning answers. A child can pause, play, chat, or resume the unfinished activity. Repeated uncertainty offers engagement instead of continuously testing. Support names feelings, acknowledges effort, offers a break, and encourages a trusted grown-up. Urgent safety phrases use a fixed grown-up-help response without a provider call.

Groq is optional and server-only. Put GROQ_API_KEY in `.env.local` for local use or Vercel server environment variables for deployment; never in a NEXT_PUBLIC variable. GROQ_MODEL defaults to llama-3.1-8b-instant; unsupported configured models fall back to rules. The route and server modules enforce the server-only boundary. Requests use Groq's documented [OpenAI-compatible endpoint](https://console.groq.com/docs/openai) and [llama-3.1-8b-instant](https://console.groq.com/docs/model/llama-3.1-8b-instant). Only eligible, open-ended Conversation/Support replies may call the model. Known SEL/greeting responses stay deterministic. No provider request is used to grade, select, or advance learning.

Each provider call races a hard 1200 ms deadline covering fetch and body parsing, and aborts on timeout. Missing key, network errors, non-2xx status, invalid response, unsafe wording, or deadline expiry return a rule fallback. The app makes no application-level provider retries. User text is a separate user-role message, while a fixed system prompt receives only validated level/mode/topic values. Obvious injection, private-information patterns and unsafe input bypass the LLM. No child text, IP, key, or provider error body is logged by application code. When enabled, eligible message text is transmitted to Groq: third-party processing is not the same as local-only storage, and keyword checks cannot detect every personal disclosure.

Every generated reply must pass a conservative safety/vocabulary gate: plain English, at most two short sentences, at most one question, no links, markup or personal-information requests. Sentence limits are 10/13/16 words for L1/L2/L3. Vocabulary expands by level; unrecognized wording falls back to rules. Generated Support replies also need a trusted-grown-up reminder. Prompt and keyword defenses reduce risk, but do not provide certified content safety or comprehensive abuse detection. The deterministic fallback remains available.

All request fields use strict Zod schemas. Raw messages are capped at 200 characters; bodies are bounded to 16 KiB including streamed data. Same-origin checks and JSON-only requests reduce cross-site use. Invalid inputs return generic errors without echoing supplied content. Security headers include CSP, HSTS, no-sniff, frame denial, referrer restrictions and disabled camera/microphone/geolocation. CSP allows inline scripts/styles for the current Next.js rendering; nonce-based hardening is outside this assessment scope.

The bounded in-memory limiter allows 60 requests per IP and 30 per random session per minute, including rate-limit retry headers. IP identity is transiently salted/hashed. Vercel's overwritten x-forwarded-for header is trusted only when VERCEL=1; non-Vercel local calls share a local bucket. See [Vercel forwarding-header behavior](https://vercel.com/docs/headers/request-headers). Limits are per server instance, reset on cold start, and are not distributed protection across instances. Random session IDs are not accounts or authentication. Use platform WAF/rate limiting or shared storage for stronger production abuse protection.

Phase 3 verification: 68/68 tests, TypeScript check and production build passed. Actual local production HTTP checks returned 200 for Support and Learning, with no-store and CSP headers. LLM success, filtering, errors, hung requests, and slow body parsing are covered using mocked provider responses and fake timers; a real keyed Groq call has not been verified. Public deployment and full end-to-end p50/p95 remain pending.
