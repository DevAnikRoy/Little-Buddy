# Architecture

Little Buddy is a Next.js App Router app. The browser holds chat text in memory and skill progress in `localStorage`. One serverless route (`POST /api/chat`) owns validation, mode estimation, the learning engine, and an optional Groq call with a hard timeout.

## System context

```mermaid
flowchart LR
  Child[Child in browser] --> UI[BuddyChat UI]
  UI -->|progress v1 JSON| Store[(localStorage)]
  Store -->|hydrate on load| UI
  UI -->|POST JSON session, action, progress, context| API["/api/chat"]
  API --> Rules[Rule engine]
  Rules --> Learn[L1-L3 curriculum]
  Rules --> Modes[Learning / Conversation / Engagement / Support]
  API -.->|open-ended Conversation or Support only| Groq[Groq llama-3.1-8b-instant]
  Groq -.->|timeout, error, or unsafe| Rules
  API -->|validated reply + next progress| UI
```

## Request path

```mermaid
sequenceDiagram
  participant UI as BuddyChat
  participant API as POST /api/chat
  participant Safety as Input gate
  participant Mode as Mode estimator
  participant Engine as Learning engine
  participant LLM as Optional Groq

  UI->>API: Zod-shaped JSON, max 16 KiB
  API->>API: IP/session rate limit, same-origin, JSON only
  API->>Safety: keyword risk on message
  alt urgent, private, unsafe, or injection
    Safety-->>UI: fixed child-safe reply, no LLM
  else Learning
    Mode->>Engine: start, answer, hint, or skip
    Engine-->>UI: next activity, mastery update, source=rules
  else Conversation, Engagement, or Support
    alt eligible open-ended turn and key present
      Mode->>LLM: 1200 ms abort, system prompt + user text
      LLM-->>UI: filtered two-sentence reply or rule fallback
    else
      Mode-->>UI: deterministic SEL or play reply
    end
  end
```

## Module map

```mermaid
flowchart TB
  subgraph Client
    Page[src/app/page.tsx]
    Chat[src/components/buddy-chat.tsx]
    Bar[PromptBar]
    Speak[read-aloud speechSynthesis]
    Page --> Chat
    Chat --> Bar
    Chat --> Speak
    Chat --> Persist[src/lib/learning/storage.ts]
  end

  subgraph Server["Node runtime, server-only"]
    Route[src/app/api/chat/route.ts]
    Limit[rate-limit.ts]
    Service[src/lib/server/chat.ts]
    LLMMod[src/lib/server/llm.ts]
    Route --> Limit
    Route --> Service
    Service --> Modes[src/lib/chat/modes.ts]
    Service --> Safe[src/lib/chat/safety.ts]
    Service --> Engine[src/lib/learning/engine.ts]
    Engine --> Curr[curriculum.ts]
    Engine --> Prog[progress.ts]
    Service --> LLMMod
  end

  Chat -->|fetch| Route
```

## What is not in the diagram

There is no database, auth, parent dashboard, or application log of child messages. Speech is browser `speechSynthesis` only. Groq is skipped when the key is missing, the model env is unsupported, the turn is a quiz, or the input is risky.
