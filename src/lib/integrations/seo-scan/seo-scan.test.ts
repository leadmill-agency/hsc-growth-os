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

  it("skips topics whose slug already exists on the site", () => {
    const slug = CONTENT_TOPICS[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const picked = pickNextSeoTargets([`https://houstonsigncrafters.com/blog/${slug}`], {
      matrixInputs: [],
      topicInputs: [CONTENT_TOPICS[1]],
    });
    expect(picked.topicInput).toBe(CONTENT_TOPICS[2]);
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
