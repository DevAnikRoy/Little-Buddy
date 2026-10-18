import { describe, expect, it } from "vitest";
import { pickBuddyVoice, scoreEnglishVoice, speechChunks } from "./buddy-voice";

describe("buddy voice picking", () => {
  it("prefers a neural English voice over a local desktop robot", () => {
    const picked = pickBuddyVoice([
      { name: "Microsoft David Desktop - English (United States)", lang: "en-US", localService: true },
      { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US", localService: false },
    ]);
    expect(picked?.name).toMatch(/Aria/);
    expect(scoreEnglishVoice("Microsoft David Desktop - English (United States)", "en-US", true))
      .toBeLessThan(scoreEnglishVoice("Microsoft Aria Online (Natural) - English (United States)", "en-US", false));
  });

  it("splits Buddy replies so speech is not one flat robot line", () => {
    expect(speechChunks("You did it! Great effort.")).toEqual(["You did it!", "Great effort."]);
  });
});
