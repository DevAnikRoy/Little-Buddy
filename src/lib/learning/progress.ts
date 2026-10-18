import { z } from "zod";
import { ACTIVITIES, LEVELS, SKILLS, SKILL_LEVEL, type Skill } from "./curriculum";

const activityId = z.string().refine(id => ACTIVITIES.some(a => a.id === id), "Unknown activity");
const counter = z.number().int().min(0).max(1_000_000);
const masterySchema = z.object({ correct: counter, wrong: counter, hints: counter, evidence: z.array(activityId).max(3), recent: z.array(z.boolean()).max(5) }).strict();
export const progressSchema = z.object({
  version: z.literal(1),
  skills: z.record(z.enum(SKILLS), masterySchema),
  context: z.object({
    activeActivityId: activityId.nullable(),
    hinted: z.boolean(),
    consecutiveWrong: z.number().int().min(0).max(2),
    recentActivityIds: z.array(activityId).max(8),
    remediation: z.boolean(),
    turns: counter,
  }).strict(),
}).strict().superRefine((state, ctx) => {
  for (const skill of SKILLS) {
    const evidence = state.skills[skill].evidence;
    if (new Set(evidence).size !== evidence.length || evidence.some(id => !ACTIVITIES.some(a => a.id === id && a.skill === skill))) {
      ctx.addIssue({ code: "custom", message: "Invalid skill evidence" });
    }
  }
  if (!state.context.activeActivityId && (state.context.hinted || state.context.remediation || state.context.consecutiveWrong)) {
    ctx.addIssue({ code: "custom", message: "Missing active activity" });
  }
});
export type Progress = z.infer<typeof progressSchema>;
export function createProgress(): Progress {
  return {
    version: 1,
    skills: z.record(z.enum(SKILLS), masterySchema).parse(Object.fromEntries(SKILLS.map(skill => [skill, { correct: 0, wrong: 0, hints: 0, evidence: [], recent: [] }]))),
    context: { activeActivityId: null, hinted: false, consecutiveWrong: 0, recentActivityIds: [], remediation: false, turns: 0 },
  };
}
export function isMastered(state: Progress, skill: Skill): boolean {
  const m = state.skills[skill];
  return m.evidence.length >= 3 && m.recent.length >= 3 && m.recent.filter(Boolean).length / m.recent.length >= 0.75;
}
export function currentLevel(state: Progress) {
  return LEVELS.find(level => SKILLS.some(skill => SKILL_LEVEL[skill] === level && !isMastered(state, skill))) ?? "L3";
}
export function isComplete(state: Progress) { return SKILLS.every(skill => isMastered(state, skill)); }

