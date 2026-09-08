// PB01 §3 — gc_pursuit_fit_score. Deterministic, transparent, inspectable (master PRD §10):
// no scores buried in opaque LLM reasoning. Each factor is 0..1 and multiplied by its weight.

export interface GcFitInputs {
  /** 0..1 — 1: Greater Houston; ~0.8: Texas metro; lower otherwise. */
  geography: number;
  /** 0..1 — explicit signage/awning scope in the signal = 1; adjacent trade lower. */
  tradeFit: number;
  /** 0..1 — project value / scope potential. */
  projectValue: number;
  /** 0..1 — GC strategic value (volume, repeatability, quality). */
  gcStrategicValue: number;
  /** 0..1 — existing HSC relationship strength. */
  relationship: number;
  /** 0..1 — timing: bidding now = 1; already awarded/past due ≈ 0. */
  timing: number;
  /** 0..1 — HSC capacity to take the work. */
  capacity: number;
  /** 0..1 — prequalification readiness (unknown = 0.5). */
  qualificationReadiness: number;
  /** 0..1 — future account value beyond this project. */
  futureAccountValue: number;
}

export const GC_FIT_WEIGHTS: Record<keyof GcFitInputs, number> = {
  geography: 15,
  tradeFit: 20,
  projectValue: 15,
  gcStrategicValue: 15,
  relationship: 10,
  timing: 10,
  capacity: 5,
  qualificationReadiness: 5,
  futureAccountValue: 5,
};

export type GcFitRecommendation = "PURSUE" | "REVIEW" | "MONITOR_PASS";

export interface GcFitScore {
  score: number;
  recommendation: GcFitRecommendation;
  factors: { factor: keyof GcFitInputs; weight: number; value: number; points: number }[];
  topPositive: string[];
  topNegative: string[];
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function scoreGcFit(inputs: GcFitInputs): GcFitScore {
  const factors = (Object.keys(GC_FIT_WEIGHTS) as (keyof GcFitInputs)[]).map((factor) => {
    const weight = GC_FIT_WEIGHTS[factor];
    const value = clamp01(inputs[factor]);
    return { factor, weight, value, points: Math.round(weight * value * 10) / 10 };
  });
  const score = Math.round(factors.reduce((sum, f) => sum + f.points, 0));

  // PB01 §3: ≥75 PURSUE; 55–74 REVIEW; <55 MONITOR/PASS. User can override with a reason.
  const recommendation: GcFitRecommendation =
    score >= 75 ? "PURSUE" : score >= 55 ? "REVIEW" : "MONITOR_PASS";

  const byImpact = [...factors].sort((a, b) => b.points - a.points);
  const byShortfall = [...factors].sort(
    (a, b) => (b.weight - b.points) - (a.weight - a.points)
  );

  return {
    score,
    recommendation,
    factors,
    topPositive: byImpact.slice(0, 3).map((f) => `${f.factor}: ${f.points}/${f.weight}`),
    topNegative: byShortfall.slice(0, 3).map((f) => `${f.factor}: ${f.points}/${f.weight}`),
  };
}
