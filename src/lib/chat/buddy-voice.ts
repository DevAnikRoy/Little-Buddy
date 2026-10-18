export function scoreEnglishVoice(name: string, lang: string, localService: boolean): number {
  const label = `${name} ${lang}`.toLowerCase();
  const locale = lang.replace("_", "-").toLowerCase();
  if (!locale.startsWith("en")) return -1000;
  let score = 10;
  if (/neural|natural|online|premium|wavenet|studio/.test(label)) score += 24;
  if (/google/.test(label)) score += 18;
  if (/aria|jenny|libby|sonia|sara|samantha|karen|moira|fiona|zira|hazel|susan/.test(label)) score += 16;
  if (/child|kid|girl|young/.test(label)) score += 10;
  if (!localService) score += 8;
  if (/en-us|en-gb|en-au|en-ie/.test(locale) || /en-us|en-gb|en-au/.test(label)) score += 4;
  if (/desktop|compact|espeak|microsoft david|mark\b|richard|george desktop/.test(label)) score -= 22;
  if (localService && !/neural|natural|google|samantha|karen|zira/.test(label)) score -= 6;
  return score;
}

export function pickBuddyVoice(voices: readonly SpeechSynthesisVoice[]) {
  const ranked = voices
    .map(voice => ({ voice, score: scoreEnglishVoice(voice.name, voice.lang, voice.localService) }))
    .filter(entry => entry.score > -500)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.voice ?? null;
}

export const BUDDY_SPEECH = { rate: 0.94, pitch: 1.18, volume: 1 } as const;

export function speechChunks(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(part => part.trim())
    .filter(Boolean);
}
