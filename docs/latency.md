# Deployed latency

Measured **18 October 2026, 12:20–12:21 PM Bangladesh time (UTC+6)** against production:

- App: [https://little-buddy-two.vercel.app](https://little-buddy-two.vercel.app)
- API: `POST /api/chat`
- Deployment function region: `iad1`
- Client: Node.js `fetch` on a Windows machine in Dhaka, Bangladesh
- Script: `node scripts/measure-latency.mjs` (writes a local sample dump under `work/`, not committed)
- Server `GROQ_API_KEY`: not set. Every timed chat reply had `source: "rules"`. The Groq path was **not** measured.

## What the timer includes

Elapsed time from starting `fetch` until the JSON body is parsed. That includes DNS, TLS, request upload, serverless execution, and download. It does **not** include React render time or tap-to-listen.

The request `Origin` is `https://little-buddy-two.vercel.app` so the route’s same-origin check matches a browser on the live host. Each call uses a new `sessionId`. Pause between calls was 400 ms.

Percentiles use nearest-rank: `sorted[ceil(p/100 * n) - 1]` on **successful** (HTTP 200) samples only.

## Chat API (rules path)

| Scenario | n | HTTP 200 | min | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| First request (`learn`, labelled cold) | 1 | 1 | 1281 | 1281 | 1281 | 1281 |
| Learn (`action: learn`) | 15 | 15 | 253 | 277 | 874 | 874 |
| Correct answer (`red` on `color-red`) | 15 | 15 | 261 | 274 | 343 | 343 |
| Support (`I am sad`) | 15 | 15 | 258 | 269 | 540 | 540 |
| Conversation (`hello`) | 15 | 15 | 252 | 270 | 473 | 473 |
| **All warm rules POSTs** | **60** | **60** | **252** | **271** | **448** | **874** |

61/61 chat POSTs returned 200. No 429 in this run.

**Normal warm conditions (this run):** p50 **271 ms**, p95 **448 ms**, both under 2 s.  
**First request in the run:** **1281 ms**, still under 2 s, but slower than the warm cluster. This is **not** a controlled idle-to-cold experiment; the instance may already have been warm.

One learn sample at 874 ms and a support sample at 540 ms show serverless/network jitter. They are inside the two-second brief for this run and they pull p95 up when n is small.

## Homepage GET (not the chat SLO)

Eight sequential `GET /` from the same machine: first 217 ms, then 62–79 ms (median of the eight ≈ 71 ms). This is document download only.

## What this does not prove

- A universal sub-two-second guarantee
- Zero cold starts, or latency after a long idle
- Slow mobile networks or distant users
- Groq open-ended turns (no production key; provider budget is still a hard 1200 ms abort plus fallback)
- Browser paint / speech synthesis
- Multi-instance rate-limiter behaviour

Reproduce:

```sh
node scripts/measure-latency.mjs
```

Optional env: `LATENCY_URL`, `LATENCY_ORIGIN`, `LATENCY_N`, `LATENCY_PAUSE_MS`.
