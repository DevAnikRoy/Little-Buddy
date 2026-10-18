# Little Buddy

English learning chatbot for children under seven. Current phase: foundation only. Chat, learning, persistence and the optional LLM are pending subsequent approved phases.

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
npm run typecheck
npm run build
```
Vitest is installed with test scripts. Behavioral tests will be added with the engine; no placeholder tests count as verification.

## Deployment
Import this repository into Vercel with the Next.js framework preset and build command `npm run build`. Add optional GROQ_API_KEY and GROQ_MODEL environment variables on the server. The included vercel.json selects Next.js. Live deployment, complete flow checks and latency benchmarks are pending.

## Scope and limitations
Rules will control L1-L3, skill mastery, activities, checking, context and modes. Optional Groq is limited to open-ended Conversation/Support replies with a 1200 ms timeout and safe fallback. Progress stays in localStorage, with no database, accounts or personal information collection. No parent panel, read-aloud or complex animations.

Provider timeout alone cannot guarantee total response latency. Deployed end-to-end p50/p95 and conditions will be reported after benchmarking. Serverless cold starts and rate-limiter limitations must be documented honestly.
