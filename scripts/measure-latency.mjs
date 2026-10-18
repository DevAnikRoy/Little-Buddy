/**
 * Deployed end-to-end POST /api/chat timings.
 * Usage: node scripts/measure-latency.mjs
 */
const URL = process.env.LATENCY_URL ?? "https://little-buddy-two.vercel.app/api/chat";
const ORIGIN = process.env.LATENCY_ORIGIN ?? "https://little-buddy-two.vercel.app";

const emptySkills = Object.fromEntries(
  ["colors", "animals", "preferences", "sentences", "descriptions", "stories"].map((skill) => [
    skill,
    { correct: 0, wrong: 0, hints: 0, evidence: [], recent: [] },
  ]),
);

function progress(activeActivityId = null, extra = {}) {
  return {
    version: 1,
    skills: structuredClone(emptySkills),
    context: {
      activeActivityId,
      hinted: false,
      consecutiveWrong: 0,
      recentActivityIds: activeActivityId ? [activeActivityId] : [],
      remediation: false,
      turns: 0,
      ...extra,
    },
  };
}

const context = { mode: "Conversation", topic: "general", disengagedTurns: 0 };

const scenarios = {
  learn: () => ({
    action: "learn",
    progress: progress(),
    context,
  }),
  answer: () => ({
    action: "message",
    message: "red",
    progress: progress("color-red"),
    context: { mode: "Learning", topic: "general", disengagedTurns: 0 },
  }),
  support: () => ({
    action: "message",
    message: "I am sad",
    progress: progress(),
    context,
  }),
  talk: () => ({
    action: "message",
    message: "hello",
    progress: progress(),
    context,
  }),
};

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function once(label, body) {
  const payload = { sessionId: crypto.randomUUID(), ...body };
  const started = performance.now();
  let status = 0;
  let source = "";
  let mode = "";
  let error = "";
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body: JSON.stringify(payload),
    });
    status = res.status;
    const json = await res.json();
    source = json.source ?? "";
    mode = json.mode ?? json.error ?? "";
    if (!res.ok) error = json.error ?? `HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const ms = Math.round(performance.now() - started);
  return { label, ms, status, source, mode, error };
}

async function run() {
  const n = Number(process.env.LATENCY_N ?? 15);
  const pause = Number(process.env.LATENCY_PAUSE_MS ?? 400);
  const names = ["learn", "answer", "support", "talk"];
  const results = [];

  console.log(`url=${URL}`);
  console.log(`n=${n} per scenario, pause=${pause}ms, started=${new Date().toISOString()}`);

  const cold = await once("cold-learn", scenarios.learn());
  results.push(cold);
  console.log("cold", cold);
  await new Promise((r) => setTimeout(r, 800));

  for (const name of names) {
    for (let i = 0; i < n; i++) {
      const row = await once(name, scenarios[name]());
      results.push(row);
      process.stdout.write(`${name} ${i + 1}/${n} ${row.ms}ms ${row.status} ${row.mode}\n`);
      if (row.status === 429) {
        const wait = 15_000;
        console.log(`rate limited, waiting ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        await new Promise((r) => setTimeout(r, pause));
      }
    }
  }

  const summary = {};
  for (const name of ["cold-learn", ...names]) {
    const rows = results.filter((r) => r.label === name);
    const ok = rows.filter((r) => r.status === 200).map((r) => r.ms).sort((a, b) => a - b);
    const fail = rows.filter((r) => r.status !== 200);
    summary[name] = {
      n: rows.length,
      ok: ok.length,
      fail: fail.length,
      min: ok[0] ?? null,
      p50: percentile(ok, 50),
      p95: percentile(ok, 95),
      max: ok[ok.length - 1] ?? null,
      statuses: Object.fromEntries(
        [...new Set(rows.map((r) => r.status))].map((s) => [s, rows.filter((r) => r.status === s).length]),
      ),
      sources: Object.fromEntries(
        [...new Set(rows.map((r) => r.source || "none"))].map((s) => [
          s,
          rows.filter((r) => (r.source || "none") === s).length,
        ]),
      ),
      sampleErrors: fail.slice(0, 3).map((r) => ({ status: r.status, error: r.error, ms: r.ms })),
    };
  }

  const warmOk = results.filter((r) => r.label !== "cold-learn" && r.status === 200).map((r) => r.ms).sort((a, b) => a - b);
  summary.warmAllRules = {
    n: warmOk.length,
    min: warmOk[0] ?? null,
    p50: percentile(warmOk, 50),
    p95: percentile(warmOk, 95),
    max: warmOk[warmOk.length - 1] ?? null,
  };

  const out = {
    url: URL,
    measuredAt: new Date().toISOString(),
    client: "node fetch from operator machine",
    groqConfiguredOnServer: "unknown; responses used source field",
    notes: [
      "Timer covers DNS+TLS+TTFB+body parse of POST /api/chat.",
      "Origin header matches the public host so the same-origin check passes.",
      "Each request uses a new sessionId. Pause avoids the 60/min IP limiter.",
      "First request is labelled cold-learn (may still be warm if the instance is hot).",
    ],
    summary,
    samples: results,
  };

  const fs = await import("node:fs/promises");
  await fs.mkdir("docs", { recursive: true });
  await fs.writeFile("docs/latency-raw.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

await run();
