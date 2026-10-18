# Little Buddy

English learning chatbot for children under seven. Rules own L1–L3 lessons, mastery, and four learning-state modes. Optional Groq may write open-ended Conversation/Support replies only, with a 1200 ms timeout and a safe fallback.

**Live URL:** [https://little-buddy-two.vercel.app](https://little-buddy-two.vercel.app)  
**Source:** [https://github.com/DevAnikRoy/Little-Buddy](https://github.com/DevAnikRoy/Little-Buddy)

| Document | Link |
| --- | --- |
| Architecture (Mermaid) | [docs/architecture.md](docs/architecture.md) |
| System design | [docs/system-design.md](docs/system-design.md) |

Production currently has **no** `GROQ_API_KEY`, so live replies are rule-based. Add the server env var on Vercel and redeploy to enable Groq. Deployed end-to-end p50/p95 is the next measurement phase.

## Local setup
Requires Node.js 22+ and npm.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. Leave `GROQ_API_KEY` empty to use rules only.

## Checks
```sh
npm test
npm run typecheck
npm run build
```
71 Vitest tests cover progression, context, persistence, mode estimation, SEL, input/output safety, provider fallback/timeouts, rate limiting, and API boundaries.

## Deployment
The GitHub `main` branch is connected to the Vercel project `little-buddy` (team `devanikroys-projects`). Framework is Next.js; build command is `npm run build`. Optional server env:

```
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
```

Never use a `NEXT_PUBLIC_` prefix for the key. `vercel.json` selects the Next.js preset. Vercel Authentication is off so the child URL is public.

To deploy a fork: import the repo in Vercel, set Production Branch to `main`, add the optional env vars, and deploy.

## Scope and limitations
Rules control L1-L3, skill mastery, activities, checking, and learning context. Four-mode detection and SEL run in the chat service. Optional Groq is limited to open-ended Conversation/Support replies. Progress stays in localStorage, with no database, accounts or personal information collection. No parent panel or complex animations. Browser-only tap-to-listen uses `speechSynthesis`.

The 1200 ms provider timeout cannot guarantee total response latency. Serverless cold starts and the in-memory rate limiter (per instance, reset on idle) are documented in [system design](docs/system-design.md). Latency numbers will be added after the measurement phase.


## Learning engine (phase 2)

Source: `src/lib/learning/`. There are 18 activities across six skills: colors/animals (L1), preferences/sentences (L2), descriptions/stories (L3). Choice-based questions and explicitly accepted text variants are checked deterministically, with case, spacing and punctuation normalization. This is not general semantic grading.

A skill is mastered after three distinct activities are answered without hints and at least 75% of the last five attempts (or all attempts if fewer than five) are independently correct. Hinted success counts as practice, not independent mastery. Wrong answers remove that activity's mastery evidence. The current level is the earliest level with any unmastered skill. At L3 completion, practice continues without inventing an L4.

One wrong answer keeps the current question. Two consecutive wrong answers select a question from the previous level (or a different L1 question). A successful easier attempt returns to the current learning level. Skipping changes the question without penalizing mastery. A start/resume action retains the active question, even across page reloads after saving.

`handleLearning(state, action)` validates and returns a new state without mutating the caller. Actions are start, answer, hint, and skip. `learningSummary` provides current level and mastered skill count for the future UI.

The localStorage adapter saves only versioned skill counters, evidence IDs, and bounded activity context under `little-buddy:progress:v1`. It stores no free-text messages or conversation transcripts. Stored data is schema-validated; malformed, oversized, and unsupported-version data resets safely in memory. Blocked storage or quota errors return a status so the UI can continue in memory. Reset removes only Little Buddy's key. Browser-local progress can be edited or cleared by the device user; it is not a trusted credential or certified achievement.

Phase 2 verification: 19/19 unit tests, TypeScript check, and production build passed. UI integration is in phase 4.


## Chat service and security (phase 3)

`POST /api/chat` accepts a random UUID sessionId, action (`start`, `message`, `hint`, `skip`, `learn`, `talk`, `play`, `break`), validated progress, and a small structured context (`mode`, `topic`, `disengagedTurns`). Only the message action includes message text. A reply returns mode, reply, choices, progress, context, optional activity, source, and outcome. The UI will keep chat text and mode context in memory; only learning progress is saved to localStorage. JSON responses have `Cache-Control: no-store`.

Rules estimate Learning, Conversation, Engagement, or Support. This is learning-state estimation, not precise emotion recognition. Personal feelings interrupt lessons; correct answers to story questions remain learning answers. A child can pause, play, chat, or resume the unfinished activity. Repeated uncertainty offers engagement instead of continuously testing. Support names feelings, acknowledges effort, offers a break, and encourages a trusted grown-up. Urgent safety phrases use a fixed grown-up-help response without a provider call.

Groq is optional and server-only. Put GROQ_API_KEY in `.env.local` for local use or Vercel server environment variables for deployment; never in a NEXT_PUBLIC variable. GROQ_MODEL defaults to llama-3.1-8b-instant; unsupported configured models fall back to rules. The route and server modules enforce the server-only boundary. Requests use Groq's documented [OpenAI-compatible endpoint](https://console.groq.com/docs/openai) and [llama-3.1-8b-instant](https://console.groq.com/docs/model/llama-3.1-8b-instant). Only eligible, open-ended Conversation/Support replies may call the model. Known SEL/greeting responses stay deterministic. No provider request is used to grade, select, or advance learning.

Each provider call races a hard 1200 ms deadline covering fetch and body parsing, and aborts on timeout. Missing key, network errors, non-2xx status, invalid response, unsafe wording, or deadline expiry return a rule fallback. The app makes no application-level provider retries. User text is a separate user-role message, while a fixed system prompt receives only validated level/mode/topic values. Obvious injection, private-information patterns and unsafe input bypass the LLM. No child text, IP, key, or provider error body is logged by application code. When enabled, eligible message text is transmitted to Groq: third-party processing is not the same as local-only storage, and keyword checks cannot detect every personal disclosure.

Every generated reply must pass a conservative safety/vocabulary gate: plain English, at most two short sentences, at most one question, no links, markup or personal-information requests. Sentence limits are 10/13/16 words for L1/L2/L3. Vocabulary expands by level; unrecognized wording falls back to rules. Generated Support replies also need a trusted-grown-up reminder. Prompt and keyword defenses reduce risk, but do not provide certified content safety or comprehensive abuse detection. The deterministic fallback remains available.

All request fields use strict Zod schemas. Raw messages are capped at 200 characters; bodies are bounded to 16 KiB including streamed data. Same-origin checks and JSON-only requests reduce cross-site use. Invalid inputs return generic errors without echoing supplied content. Security headers include CSP, HSTS, no-sniff, frame denial, referrer restrictions and disabled camera/microphone/geolocation. CSP allows inline scripts/styles for the current Next.js rendering; nonce-based hardening is outside this assessment scope.

The bounded in-memory limiter allows 60 requests per IP and 30 per random session per minute, including rate-limit retry headers. IP identity is transiently salted/hashed. Vercel's overwritten x-forwarded-for header is trusted only when VERCEL=1; non-Vercel local calls share a local bucket. See [Vercel forwarding-header behavior](https://vercel.com/docs/headers/request-headers). Limits are per server instance, reset on cold start, and are not distributed protection across instances. Random session IDs are not accounts or authentication. Use platform WAF/rate limiting or shared storage for stronger production abuse protection.

Phase 3 verification: 68/68 tests, TypeScript check and production build passed. Actual local production HTTP checks returned 200 for Support and Learning, with no-store and CSP headers. LLM success, filtering, errors, hung requests, and slow body parsing are covered using mocked provider responses and fake timers; a real keyed Groq call has not been verified on production (no Groq env). Live URL is deployed; end-to-end p50/p95 remain pending.


## Child-friendly UI (phase 4)

The responsive interface connects to `/api/chat`, with a bear emoji, three large Learn/Play/Talk controls, answer choices, hints, skip, a message composer capped at 200 characters, and Happy/Sad/Tired shortcuts. The side journey shows the computed current level and six mastered skills. It condenses into a short trail on phones. There is no parent/demo panel. The later UI polish adds browser-only tap-to-listen and lightweight CSS feedback.

A guarded request lock prevents double submits. Each response is validated with Zod before rendering or saving; curriculum activity content must match the canonical catalog. Successful turns update progress atomically; failures leave the unfinished question and typed input available. Responses and child messages are rendered as text, never injected HTML. Conversation text stays in memory, bounded to 30 recent messages. A six-second client network recovery timeout is separate from the 1200 ms provider timeout; it does not claim slow connections meet the performance target.

Progress hydrates from localStorage after mount and restores the unfinished lesson, including its hint state. The small Reset progress control asks before clearing the app's own progress key. Reset does not change the rate-limit session or remove its cooldown. Storage failures show a notice and allow in-memory play. Requests have a rate-limit cooldown, visible errors, and busy states.

Accessibility includes named controls, keyboard form submission, visible focus, an announced reply/status, an independently scrolling transcript, native progress element, and a reset dialog with focus trapping, Escape/cancel and focus restoration. The informational grown-up note explains rule-based learning-state estimation and optional third-party AI processing.

Manual browser verification on the local production app: Learn -> correct Red answer -> next Blue question; hint; Sad -> Support without a quiz; resume Learn; reload -> unfinished Blue question restored; typed animal conversation submitted with Enter; Play -> pretend choices; cancel/reset -> fresh L1 welcome persisted across reload. Mobile viewport check: document width 375 CSS px, scroll width 375 CSS px (no horizontal overflow). Desktop and phone screenshots inspected. An actual browser-origin hostname mismatch was fixed and covered by an API regression test. Live URL: https://little-buddy-two.vercel.app. Real keyed Groq flow and latency benchmarks remain pending.


## Child-first UI polish

Work is confined to the `polish` branch. The learning engine, server API, and all existing tests are unchanged. The interface now uses a simplified bear/three-level-dot/progress sidebar, one Learn/Play/Talk group, large 3D feelings buttons, equal-sized short answer choices, 16px minimum visible text, and at least 56px button targets. Primary labels are short and paired with pictures. The palette combines warm paper with soft mint, honey and lavender; rounded Nunito is served locally with font-display swap.

Every Buddy message has a tap-to-listen/stop control using browser `speechSynthesis`: English voice (local English preferred), rate 0.78, and no application speech API. There is no autoplay. Browser/OS voice availability varies; missing voices or audio failures have a gentle fallback. Device speech services may implement some voices remotely; the app itself does not call an external speech provider.

React Bits Prompt Bar was installed through its documented CSS variant:

```sh
npx --yes shadcn@latest add @react-bits/PromptBar-TS-CSS --yes
```

`components.json` records the registry. The installed source was adapted in `src/components/PromptBar.tsx` and `PromptBar.css`: retained field/footer/send-glyph composition, controlled one-line draft, 200-character cap and existing submit behavior. Model/effort pickers, attachments, dictation, source menus and canvas spark rendering were removed for young children. Unused installer-added motion/hugeicons dependencies were removed again; no new animation runtime remains in package.json.

All eight icons are local optimized WebP, lazy-loaded with fixed dimensions and async decoding; each is below 6 KB (30,902 bytes total). Nunito's local Latin variable WOFF2 is 39,128 bytes. No images/fonts load from third-party servers at runtime. Replies are fully present immediately and receive a 180ms CSS reveal; correct answers get seven small CSS sparkles, and button presses have gentle feedback. Reduced-motion users receive no reveal, bounce, typing pulse or sparkle motion. No WebGL, scroll hijacking, autoplay sound, or artificial response delay is added.

### Credits and Licenses

- **3dicons — Vijay Verma:** pencil (`learn.webp`), rocket (`play.webp`), chat text (`talk.webp`), star (`star.webp`), downloaded from the official V1 color asset URLs in the source repository. [3dicons](https://3dicons.co/) states **CC0**; the [repository license](https://github.com/realvjy/3dicons/blob/develop/LICENSE) is CC0 1.0 Universal. Attribution is voluntary. Full text: `public/licenses/3dicons-cc0.txt`.
- **Microsoft Fluent Emoji:** grinning face (`happy.webp`), sad but relieved face (`sad.webp`), sleeping face (`tired.webp`), and bear (`bear.webp`), from the official repository's 3D PNG assets, converted to WebP. [MIT license](https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE), copyright Microsoft Corporation; notice preserved in `public/licenses/fluent-emoji.txt`. The explicit faces were chosen to make feelings easier to recognise. All exact icon source URLs, authors, license labels, and optimized byte sizes are recorded in `public/icons/sources.json`.
- **React Bits Prompt Bar — David Haz:** [component](https://reactbits.dev/micro/prompt-bar), [installation documentation](https://reactbits.dev/get-started/installation), [license](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md). **MIT + Commons Clause**, not plain MIT: permission covers use/modification within an application, with a restriction on selling, sublicensing or redistributing the components themselves. This is an adapted part of Little Buddy, not a component resale package. Copyright and full license preserved in `public/licenses/react-bits.txt` and source comments.
- **Nunito:** local Latin variable font distributed by [Fontsource](https://fontsource.org/fonts/nunito), version 5.3.0. Font file source: `https://cdn.jsdelivr.net/npm/@fontsource-variable/nunito@5.3.0/files/nunito-latin-wght-normal.woff2`. **SIL Open Font License 1.1**, preserved in `public/licenses/nunito-ofl.txt`, from the [Google Fonts Nunito source](https://github.com/google/fonts/tree/main/ofl/nunito). No proprietary reference-site fonts were copied.
- **Scrolltide:** [public library](https://www.scrolltide.co/) studied for separated content areas, interaction-focused controls and reveal ideas. Implementation is original lightweight CSS; no template, prompt, preview video, image, shader or component source was copied. Its [terms](https://www.scrolltide.co/terms) describe a limited personal/client-use product license and restrict redistribution and marketing-asset reuse. No paid license was acquired or required for the independent implementation.
- **Refero Styles:** studied [Slush](https://styles.refero.design/style/8b6b547f-a357-4f1b-9842-4579c62dd42b) for pastel surfaces/soft sticker shapes and [Notion](https://styles.refero.design/style/2bf4c61f-de10-4614-ba1b-20c0453bd2a9) for warm-paper palette/spacing. These were visual references only. A reusable license for Refero's generated code/assets was not established (the attempted parent-site terms URL was unavailable), so no screenshots, DESIGN.md text, generated CSS, assets or proprietary fonts were redistributed. Little Buddy uses its own CSS and licensed Nunito.

### Polish verification and intentional simplifications

Production builds passed after icon assets, Icon3D, Prompt Bar installation/adaptation, read-aloud component, and the integrated UI batches. Desktop browser checks confirmed loaded local icons, a single mode navigation group, no visible text below 16px and no buttons below 56px. Phone checks at 375 CSS px confirmed no horizontal overflow, large feeling controls, learning answers and Support transitions. Listen toggles to Stop on tap. Network failure was tested by stopping the owned local server: a friendly error appeared while the draft and learning state were retained. The final test/build result is recorded below.

Skipped deliberately: paid Scrolltide templates, copied Refero code/fonts, full developer-oriented Prompt Bar controls, heavy animation libraries/WebGL and autoplay. English speech availability depends on the browser/OS; no external speech service was added. Reduced motion is implemented in CSS. No backend or API latency logic changed.

Final polish verification: 71/71 existing tests passed; TypeScript check passed; final production build passed after granting access to the Windows build-output cache. No cache/source deletion was needed. Final mobile check: three equal-width answer choices, three aligned 96px feelings buttons, 0 button targets below 56px, and no horizontal overflow at 375px. Listen/Stop toggled without a cancellation error. The owned preview server was stopped before completion. No push was performed.
