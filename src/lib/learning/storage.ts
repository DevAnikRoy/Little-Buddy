import { createProgress, progressSchema, type Progress } from "./progress";

export const STORAGE_KEY = "little-buddy:progress:v1";
export type ProgressStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StorageStatus = "loaded" | "new" | "invalid" | "unavailable";
function browserStorage(): ProgressStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; } catch { return undefined; }
}
export function loadProgress(storage: ProgressStorage | undefined = browserStorage()): { state: Progress; status: StorageStatus } {
  if (!storage) return { state: createProgress(), status: "unavailable" };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { state: createProgress(), status: "new" };
    if (raw.length > 20_000) return { state: createProgress(), status: "invalid" };
    const parsed = progressSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { state: parsed.data, status: "loaded" } : { state: createProgress(), status: "invalid" };
  } catch (error) {
    return { state: createProgress(), status: error instanceof SyntaxError ? "invalid" : "unavailable" };
  }
}
export function saveProgress(state: Progress, storage: ProgressStorage | undefined = browserStorage()): boolean {
  if (!storage) return false;
  const parsed = progressSchema.safeParse(state);
  if (!parsed.success) return false;
  try { storage.setItem(STORAGE_KEY, JSON.stringify(parsed.data)); return true; } catch { return false; }
}
export function resetProgress(storage: ProgressStorage | undefined = browserStorage()): { state: Progress; persisted: boolean } {
  const state = createProgress();
  if (!storage) return { state, persisted: false };
  try { storage.removeItem(STORAGE_KEY); return { state, persisted: true }; } catch { return { state, persisted: false }; }
}
