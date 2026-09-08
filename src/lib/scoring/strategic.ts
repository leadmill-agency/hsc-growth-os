// Master PRD §10.2 — Account Strategic Score. Deterministic and inspectable,
// used by PB02/PB03/PB04 to rank multi-location / multi-opportunity accounts.

export interface StrategicInputs {
  /** 0..1 — potential annual revenue for HSC. */
  revenuePotential: number;
  /** 0..1 — number of locations/opportunities in play (1 at ~20+ Texas locations). */
  locationCount: number;
  /** 0..1 — likelihood of future project volume (expansion velocity). */
  futureVolume: number;
  /** 0..1 — repeatability of the work (standardized packages score high). */
  repeatability: number;
  /** 0..1 — concentration in Greater Houston / HSC's install radius. */
  localConcentration: number;
  /** 0..1 — how many HSC trades fit (signs + awnings + interior + service). */
  multiTradeFit: number;
  /** 0..1 — relationship leverage (existing customer/warm path = high). */
  relationshipLeverage: number;
  /** 0..1 — brand/reference value of winning this account. */
  referenceValue: number;
}

export const STRATEGIC_WEIGHTS: Record<keyof StrategicInputs, number> = {
  revenuePotential: 20,
  locationCount: 15,
  futureVolume: 15,
  repeatability: 15,
  localConcentration: 10,
  multiTradeFit: 10,
  relationshipLeverage: 10,
  referenceValue: 5,
};

export interface StrategicScore {
  score: number;
  band: "strategic_priority" | "strong" | "monitor" | "low";
  factors: { factor: keyof StrategicInputs; weight: number; value: number; points: number }[];
}

export function scoreStrategic(inputs: StrategicInputs): StrategicScore {
  const factors = (Object.keys(STRATEGIC_WEIGHTS) as (keyof StrategicInputs)[]).map((factor) => {
    const weight = STRATEGIC_WEIGHTS[factor];
    const value = Math.min(1, Math.max(0, inputs[factor]));
    return { factor, weight, value, points: Math.round(weight * value * 10) / 10 };
  });
  const score = Math.round(factors.reduce((s, f) => s + f.points, 0));
  const band =
    score >= 80 ? "strategic_priority" : score >= 60 ? "strong" : score >= 40 ? "monitor" : "low";
  return { score, band, factors };
}

/** Map a Texas location count onto 0..1 for locationCount. */
export function locationCountValue(count: number): number {
  if (count >= 20) return 1;
  if (count >= 10) return 0.8;
  if (count >= 5) return 0.6;
  if (count >= 2) return 0.35;
  return 0.15;
}
