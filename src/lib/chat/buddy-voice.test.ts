import { describe, expect, it } from "vitest";
import { pickBuddyVoice, scoreEnglishVoice, speechChunks } from "./buddy-voice";

function mockVoice(name: string, lang: string, localService: boolean): SpeechSynthesisVoice {
  return { name, lang, localService, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

describe("buddy voice picking", () => {
  it("prefers a neural English voice over a local desktop robot", () => {
    const picked = pickBuddyVoice([
      mockVoice("Microsoft David Desktop - English (United States)", "en-US", true),
      mockVoice("Microsoft Aria Online (Natural) - English (United States)", "en-US", false),
    ]);
    expect(picked?.name).toMatch(/Aria/);
    expect(scoreEnglishVoice("Microsoft David Desktop - English (United States)", "en-US", true))
      .toBeLessThan(scoreEnglishVoice("Microsoft Aria Online (Natural) - English (United States)", "en-US", false));
  });

  it("splits Buddy replies so speech is not one flat robot line", () => {
    expect(speechChunks("You did it! Great effort.")).toEqual(["You did it!", "Great effort."]);
  });
});
