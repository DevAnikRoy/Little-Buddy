# Little Buddy development instructions

- Complete one approved phase at a time; report verification before moving on.
- Priority: deployed working app, documentation, then English video preparation.
- Use Next.js App Router, TypeScript, Zod, Vitest, and Vercel.
- Rules own L1-L3, skill mastery (correct/wrong/hints), activities, checking, four modes, and context.
- When a child gets stuck, provide hints and easier activities. Praise effort, name feelings, offer choices, and ask one small question at a time.
- Modes: Learning, Conversation, Engagement, Support. Call this rule-based learning-state estimation, not precise emotion recognition.
- Store progress in browser localStorage. No database, accounts, PII, parent panel, read-aloud, or complex animations. Include a small Reset progress button.
- Optional Groq llama-3.1-8b-instant is server-only, for open-ended Conversation/Support replies only.
- Every LLM request has a 1200 ms abort timeout and deterministic fallback on timeout/error/unsafe output.
- Keep keys in server environment variables. Never commit secrets or log child messages.
- Validate all external inputs using Zod; cap messages at 200 characters. Rate limit by IP/session and document serverless limitations.
- Filter every LLM response and limit to two short, level-appropriate sentences. Keep user text separate from system instructions; never ask for personal information.
- Support replies are calm and empathetic and encourage speaking to a trusted grown-up when appropriate.
- Include security headers. No sensitive data in logs.
- Unit-test mastery/progression, mode detection, context, and LLM fallback/safety. Run type checking and production build.
- Verify live Vercel flow. Measure deployed end-to-end p50/p95 and state benchmark conditions; do not promise a universal sub-two-second guarantee or zero cold starts.
- Deliver README, Mermaid architecture, system design, test/latency results, and a two-minute English video script.
- Reserve the final 20 minutes as buffer; no new features.
