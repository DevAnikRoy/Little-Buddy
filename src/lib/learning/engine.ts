import { z } from "zod";
import { ACTIVITIES, LEVELS, SKILL_LEVEL, getActivity, type Activity } from "./curriculum";
import { currentLevel, isComplete, isMastered, progressSchema, type Progress } from "./progress";

export const learningActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start") }).strict(),
  z.object({ type: z.literal("answer"), message: z.string().trim().min(1).max(200) }).strict(),
  z.object({ type: z.literal("hint") }).strict(),
  z.object({ type: z.literal("skip") }).strict(),
]);
export type LearningAction = z.infer<typeof learningActionSchema>;
export type LearningResult = { state: Progress; activity: Activity; reply: string; outcome: "ready" | "correct" | "incorrect" | "hint" | "skipped"; levelChanged: boolean; complete: boolean };
export function normalizeAnswer(text: string) {
  return text.toLowerCase().normalize("NFKC").replace(/[’']/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
export function checkAnswer(activity: Activity, message: string) {
  return activity.answers.some(answer => normalizeAnswer(answer) === normalizeAnswer(message));
}
function selectActivity(state: Progress, easier = false): Activity {
  const levelIndex = LEVELS.indexOf(currentLevel(state));
  const level = LEVELS[easier ? Math.max(0, levelIndex - 1) : levelIndex];
  const atLevel = ACTIVITIES.filter(a => a.level === level);
  const weak = atLevel.filter(a => !isMastered(state, a.skill));
  const pool = weak.length ? weak : atLevel;
  // Prefer fresh independent evidence. Never immediately repeat a skipped item.
  const withoutCurrent = pool.filter(a => a.id !== state.context.activeActivityId);
  const candidates = withoutCurrent.length ? withoutCurrent : pool;
  return [...candidates].sort((a, b) => {
    const score = (item: Activity) => {
      const recent = state.context.recentActivityIds.lastIndexOf(item.id);
      return (state.skills[item.skill].evidence.includes(item.id) ? 100 : 0) + (recent < 0 ? 0 : 10 + recent);
    };
    return score(a) - score(b);
  })[0];
}
function activate(state: Progress, activity: Activity, remediation = false) {
  state.context.activeActivityId = activity.id;
  state.context.hinted = false;
  state.context.consecutiveWrong = 0;
  state.context.remediation = remediation;
  state.context.recentActivityIds = [...state.context.recentActivityIds, activity.id].slice(-8);
}
export function handleLearning(input: Progress, rawAction: LearningAction): LearningResult {
  // Validate and clone: callers retain their state, including when an action is rejected.
  const state = progressSchema.parse(input);
  const action = learningActionSchema.parse(rawAction);
  const previousLevel = currentLevel(state);
  let outcome: LearningResult["outcome"] = "ready";
  let reply = "Let's try one little question!";
  if (!state.context.activeActivityId) activate(state, selectActivity(state));
  const active = getActivity(state.context.activeActivityId!);
  if (action.type === "hint") {
    if (!state.context.hinted) state.skills[active.skill].hints = Math.min(1_000_000, state.skills[active.skill].hints + 1);
    state.context.hinted = true;
    reply = active.hint;
    outcome = "hint";
  } else if (action.type === "skip") {
    activate(state, selectActivity(state));
    reply = "That's okay. Let's try a different one!";
    outcome = "skipped";
  } else if (action.type === "answer") {
    const mastery = state.skills[active.skill];
    const correct = checkAnswer(active, action.message);
    const independent = correct && !state.context.hinted;
    mastery.recent = [...mastery.recent, independent].slice(-5);
    if (correct) {
      mastery.correct = Math.min(1_000_000, mastery.correct + 1);
      if (independent && !mastery.evidence.includes(active.id)) mastery.evidence.push(active.id);
      reply = state.context.hinted ? "You kept trying! We can practise that again later." : "You did it! Great effort.";
      activate(state, selectActivity(state));
      outcome = "correct";
    } else {
      mastery.wrong = Math.min(1_000_000, mastery.wrong + 1);
      mastery.evidence = mastery.evidence.filter(id => id !== active.id);
      state.context.consecutiveWrong = Math.min(2, state.context.consecutiveWrong + 1);
      outcome = "incorrect";
      if (state.context.consecutiveWrong >= 2) {
        activate(state, selectActivity(state, true), true);
        reply = "Thank you for trying. Let's try an easier little question!";
      } else {
        reply = "Good try! You can try again or ask for a hint.";
      }
    }
  }
  if (action.type !== "start") state.context.turns = Math.min(1_000_000, state.context.turns + 1);
  const levelChanged = previousLevel !== currentLevel(state);
  if (levelChanged && outcome === "correct") reply = "Your practice helped you grow! Let's try the next level.";
  if (isComplete(state) && outcome === "correct") reply = "You practised every skill! We can keep playing and learning.";
  return { state, activity: getActivity(state.context.activeActivityId!), reply, outcome, levelChanged, complete: isComplete(state) };
}
export function learningSummary(state: Progress) {
  return { level: currentLevel(state), complete: isComplete(state), masteredSkills: Object.keys(SKILL_LEVEL).filter(skill => isMastered(state, skill as keyof typeof SKILL_LEVEL)).length, totalSkills: 6 };
}
