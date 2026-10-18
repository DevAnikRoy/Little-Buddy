# Little Buddy

English learning chatbot for children under seven. Current phase: learning engine and localStorage adapter complete and unit-tested. Chat UI, mode detection, optional LLM, and deployment are pending subsequent approved phases. The foundation page is not yet connected to the engine.

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
19 Vitest tests cover progression, checking, hint-assisted answers, context, remediation, and persistence. TypeScript check and production build pass.

## Deployment
Import this repository into Vercel with the Next.js framework preset and build command `npm run build`. Add optional GROQ_API_KEY and GROQ_MODEL environment variables on the server. The included vercel.json selects Next.js. Live deployment, complete flow checks and latency benchmarks are pending.

## Scope and limitations
Rules now control L1-L3, skill mastery, activities, checking, and learning context. Four-mode detection is next. Optional Groq is limited to open-ended Conversation/Support replies with a 1200 ms timeout and safe fallback. Progress stays in localStorage, with no database, accounts or personal information collection. No parent panel, read-aloud or complex animations.

Provider timeout alone cannot guarantee total response latency. Deployed end-to-end p50/p95 and conditions will be reported after benchmarking. Serverless cold starts and rate-limiter limitations must be documented honestly.


## Learning engine (phase 2)

Source: `src/lib/learning/`. There are 18 activities across six skills: colors/animals (L1), preferences/sentences (L2), descriptions/stories (L3). Choice-based questions and explicitly accepted text variants are checked deterministically, with case, spacing and punctuation normalization. This is not general semantic grading.

A skill is mastered after three distinct activities are answered without hints and at least 75% of the last five attempts (or all attempts if fewer than five) are independently correct. Hinted success counts as practice, not independent mastery. Wrong answers remove that activity's mastery evidence. The current level is the earliest level with any unmastered skill. At L3 completion, practice continues without inventing an L4.

One wrong answer keeps the current question. Two consecutive wrong answers select a question from the previous level (or a different L1 question). A successful easier attempt returns to the current learning level. Skipping changes the question without penalizing mastery. A start/resume action retains the active question, even across page reloads after saving.

`handleLearning(state, action)` validates and returns a new state without mutating the caller. Actions are start, answer, hint, and skip. `learningSummary` provides current level and mastered skill count for the future UI.

The localStorage adapter saves only versioned skill counters, evidence IDs, and bounded activity context under `little-buddy:progress:v1`. It stores no free-text messages or conversation transcripts. Stored data is schema-validated; malformed, oversized, and unsupported-version data resets safely in memory. Blocked storage or quota errors return a status so the UI can continue in memory. Reset removes only Little Buddy's key. Browser-local progress can be edited or cleared by the device user; it is not a trusted credential or certified achievement.

Phase 2 verification: 19/19 unit tests, TypeScript check, and production build passed. Browser/UI integration verification is pending phase 4.
