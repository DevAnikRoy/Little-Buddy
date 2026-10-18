import { describe, expect, it } from "vitest";
import { ACTIVITIES, getActivity } from "./curriculum";
import { checkAnswer, handleLearning, learningSummary } from "./engine";
import { createProgress, currentLevel, isComplete, isMastered, progressSchema, type Progress } from "./progress";
import { loadProgress, resetProgress, saveProgress, STORAGE_KEY, type ProgressStorage } from "./storage";

function ready() { return handleLearning(createProgress(), { type: "start" }).state; }
function answer(state: Progress, correct = true) {
  const active = getActivity(state.context.activeActivityId!);
  return handleLearning(state, { type: "answer", message: correct ? active.answers[0] : "not an answer" });
}
function reach(level: "L2" | "L3") {
  let state = ready();
  for (let i = 0; i < 30 && currentLevel(state) !== level; i++) state = answer(state).state;
  expect(currentLevel(state)).toBe(level);
  return state;
}
function memory(): ProgressStorage {
  const data = new Map<string, string>();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } };
}

describe("curriculum and checking", () => {
  it("has unique IDs, three activities per skill, and valid answer choices", () => {
    expect(new Set(ACTIVITIES.map(a => a.id)).size).toBe(ACTIVITIES.length);
    for (const skill of Object.keys(createProgress().skills)) expect(ACTIVITIES.filter(a => a.skill === skill)).toHaveLength(3);
    for (const activity of ACTIVITIES) expect(activity.choices.some(choice => checkAnswer(activity, choice))).toBe(true);
  });
  it("normalizes case, spacing, punctuation, and hyphenated words", () => {
    expect(checkAnswer(getActivity("color-red"), "  RED!! ")).toBe(true);
    expect(checkAnswer(getActivity("story-help"), "A grown-up.")).toBe(true);
    expect(checkAnswer(getActivity("color-red"), "red or blue")).toBe(false);
    expect(checkAnswer(getActivity("color-red"), "not red")).toBe(false);
  });
  it("rejects empty, oversized and unknown input", () => {
    for (const message of [" ", "a".repeat(201)]) expect(() => handleLearning(ready(), { type: "answer", message })).toThrow();
    expect(() => getActivity("missing")).toThrow();
    expect(() => handleLearning(ready(), { type: "start", extra: true } as never)).toThrow();
  });
});

describe("progression and mastery", () => {
  it("starts at L1 with independent progress objects", () => {
    const a = createProgress(); const b = createProgress(); a.skills.colors.correct++;
    expect(b.skills.colors.correct).toBe(0);
    expect(currentLevel(b)).toBe("L1"); expect(isComplete(b)).toBe(false);
  });
  it("unlocks L2 only when both L1 skills are mastered", () => {
    let state = ready();
    for (let i = 0; i < 5; i++) { state = answer(state).state; expect(currentLevel(state)).toBe("L1"); }
    const result = answer(state);
    expect(result.levelChanged).toBe(true); expect(result.activity.level).toBe("L2");
    expect(isMastered(result.state, "colors")).toBe(true); expect(isMastered(result.state, "animals")).toBe(true);
  });
  it("progresses through L3 and completes all six skills", () => {
    let state = ready();
    for (let i = 0; i < 18; i++) state = answer(state).state;
    expect(learningSummary(state)).toEqual({ level: "L3", complete: true, masteredSkills: 6, totalSkills: 6 });
    expect(progressSchema.safeParse(state).success).toBe(true);
  });
  it("tracks wrong answers and does not reward guesses", () => {
    const state = ready(); const skill = getActivity(state.context.activeActivityId!).skill;
    const result = answer(state, false);
    expect(result.state.skills[skill].wrong).toBe(1); expect(result.state.skills[skill].evidence).toHaveLength(0);
    expect(currentLevel(result.state)).toBe("L1");
  });
  it("counts one hint per activity attempt and excludes hinted success from mastery", () => {
    const state = ready(); const skill = getActivity(state.context.activeActivityId!).skill;
    const hinted = handleLearning(state, { type: "hint" });
    const hintedAgain = handleLearning(hinted.state, { type: "hint" });
    const result = answer(hintedAgain.state);
    expect(result.state.skills[skill].hints).toBe(1); expect(result.state.skills[skill].correct).toBe(1);
    expect(result.state.skills[skill].evidence).toHaveLength(0); expect(result.state.skills[skill].recent).toEqual([false]);
    expect(result.state.context.hinted).toBe(false);
  });
  it("requires diverse evidence and recent accuracy", () => {
    const state = createProgress();
    state.skills.colors.evidence = ["color-red", "color-blue", "color-yellow"];
    state.skills.colors.recent = [true, true, false, false, true];
    expect(isMastered(state, "colors")).toBe(false);
    state.skills.colors.recent = [true, true, true, false];
    expect(isMastered(state, "colors")).toBe(true);
  });
});

describe("context and recovery", () => {
  it("resumes the active question without consuming a turn or mutating its input", () => {
    const state = ready(); const before = JSON.stringify(state);
    const result = handleLearning(state, { type: "start" });
    expect(result.activity.id).toBe(state.context.activeActivityId);
    expect(result.state.context.turns).toBe(0); expect(JSON.stringify(state)).toBe(before);
  });
  it("keeps a question after one mistake and changes to an easier level after two", () => {
    const state = reach("L2");
    const first = answer(state, false); expect(first.activity.id).toBe(state.context.activeActivityId);
    const second = answer(first.state, false);
    expect(second.activity.level).toBe("L1"); expect(second.state.context.remediation).toBe(true);
    expect(second.state.context.consecutiveWrong).toBe(0);
    const recovered = answer(second.state);
    expect(recovered.activity.level).toBe("L2"); expect(recovered.state.context.remediation).toBe(false);
  });
  it("uses L2 remediation for an L3 learner", () => {
    const result = answer(answer(reach("L3"), false).state, false);
    expect(result.activity.level).toBe("L2");
  });
  it("offers a different simple question when stuck in L1", () => {
    const state = ready(); const result = answer(answer(state, false).state, false);
    expect(result.activity.level).toBe("L1"); expect(result.activity.id).not.toBe(state.context.activeActivityId);
  });
  it("skips without changing mastery and bounds recent history", () => {
    let state = ready(); const skills = JSON.stringify(state.skills);
    for (let i = 0; i < 20; i++) {
      const result = handleLearning(state, { type: "skip" });
      expect(result.activity.id).not.toBe(state.context.activeActivityId); state = result.state;
    }
    expect(JSON.stringify(state.skills)).toBe(skills); expect(state.context.recentActivityIds).toHaveLength(8);
  });
});

describe("local persistence", () => {
  it("round-trips context and progress, including hints, without storing messages", () => {
    const store = memory(); const state = handleLearning(ready(), { type: "hint" }).state;
    expect(saveProgress(state, store)).toBe(true);
    expect(loadProgress(store)).toEqual({ state, status: "loaded" });
    expect(Object.keys(JSON.parse(store.getItem(STORAGE_KEY)!))).toEqual(["version", "skills", "context"]);
    expect(JSON.stringify(state)).not.toContain("message");
  });
  it("handles absent, corrupt, oversized, and unsupported-version data", () => {
    const store = memory(); expect(loadProgress(store).status).toBe("new");
    for (const raw of ["{", "x".repeat(20_001), JSON.stringify({ ...createProgress(), version: 2 })]) {
      store.setItem(STORAGE_KEY, raw); const result = loadProgress(store);
      expect(result.status).toBe("invalid"); expect(result.state).toEqual(createProgress());
    }
  });
  it("rejects unknown activity IDs and duplicated or mismatched evidence", () => {
    const store = memory();
    for (const evidence of [["color-red", "color-red"], ["animal-cat"], ["missing"]]) {
      const state = createProgress(); state.skills.colors.evidence = evidence;
      expect(saveProgress(state, store)).toBe(false);
    }
    const state = ready(); state.context.activeActivityId = "missing";
    store.setItem(STORAGE_KEY, JSON.stringify(state)); expect(loadProgress(store).status).toBe("invalid");
  });
  it("handles blocked storage without crashing", () => {
    const blocked: ProgressStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("blocked"); } };
    expect(loadProgress(blocked).status).toBe("unavailable");
    expect(saveProgress(createProgress(), blocked)).toBe(false); expect(resetProgress(blocked).persisted).toBe(false);
    expect(loadProgress().status).toBe("unavailable");
  });
  it("resets only its own key", () => {
    const store = memory(); store.setItem("unrelated", "keep"); saveProgress(reach("L2"), store);
    expect(resetProgress(store)).toEqual({ state: createProgress(), persisted: true });
    expect(store.getItem(STORAGE_KEY)).toBeNull(); expect(store.getItem("unrelated")).toBe("keep");
  });
});
