import { describe, expect, it } from "vitest";
import { pickNextSeoTargets, seoMatrixCombos, startOfWeekUtc, CONTENT_TOPICS } from "./weekly";

describe("weekly SEO scan target picker", () => {
  it("skips combos the sitemap already covers and combos already drafted", () => {
    const combos = seoMatrixCombos();
    const first = combos[0];
    const second = combos[1];
    // Site covers the first combo, a prior run drafted the second.
    const [geo, product] = first.split("×").map((s) => s.trim());
    const coveredUrl = `https://houstonsigncrafters.com/${geo.toLowerCase().replace(/\s+/g, "-")}-${product
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
    const picked = pickNextSeoTargets([coveredUrl], {
      matrixInputs: [second],
      topicInputs: [],
    });
    expect(picked.matrixInput).toBe(combos[2]);
    expect(picked.topicInput).toBe(CONTENT_TOPICS[0]);
  });

  it("prefers GSC gap queries over the backlog", () => {
    const picked = pickNextSeoTargets([], { matrixInputs: [], topicInputs: [] }, [
      "building signs houston",
      "banners houston tx",
    ]);
    expect(picked.topicInput).toBe("building signs houston");
  });

  it("skips a gap query an existing page already covers, and near-duplicates of prior drafts", () => {
    const picked = pickNextSeoTargets(
      ["https://houstonsigncrafters.com/building-signs-houston"],
      { matrixInputs: [], topicInputs: ["banners houston"] },
      ["building signs houston", "banners houston tx", "sign shop houston"]
    );
    // First gap covered by the site, second is a near-duplicate of a prior draft
    expect(picked.topicInput).toBe("sign shop houston");
  });

  it("regression: keyword coverage catches the permit-post near-duplicate a slug check missed", () => {
    const picked = pickNextSeoTargets(
      ["https://houstonsigncrafters.com/blog/houston-business-sign-permits"],
      { matrixInputs: [], topicInputs: [] },
      ["do i need a permit for a business sign in houston"]
    );
    // CONTENT_TOPICS[0] is the same question — both must be skipped as covered
    expect(picked.topicInput).not.toBe("do i need a permit for a business sign in houston");
    expect(picked.topicInput).not.toBe(CONTENT_TOPICS[0]);
    expect(picked.topicInput).toBe(CONTENT_TOPICS[1]);
  });

  it("returns null when every target is exhausted", () => {
    const picked = pickNextSeoTargets([], {
      matrixInputs: seoMatrixCombos(),
      topicInputs: [...CONTENT_TOPICS],
    });
    expect(picked.matrixInput).toBeNull();
    expect(picked.topicInput).toBeNull();
  });

  it("computes Monday 00:00 UTC as the week start", () => {
    // Friday 2026-09-18 → Monday 2026-09-14
    expect(startOfWeekUtc(new Date("2026-09-18T20:00:00Z")).toISOString()).toBe(
      "2026-09-14T00:00:00.000Z"
    );
    // Sunday belongs to the week that started the previous Monday
    expect(startOfWeekUtc(new Date("2026-09-20T05:00:00Z")).toISOString()).toBe(
      "2026-09-14T00:00:00.000Z"
    );
    // Monday itself
    expect(startOfWeekUtc(new Date("2026-09-21T13:00:00Z")).toISOString()).toBe(
      "2026-09-21T00:00:00.000Z"
    );
  });
});
