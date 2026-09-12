// Dismissal reason codes (per Rameel 2026-09-12): required on every dismissal —
// each one is a labeled training example of what a BAD opportunity looks like.
// The radar reads recent dismissal patterns back into its scoring prompt.
export const DISMISS_REASONS: [string, string][] = [
  ["too_far", "Too far away"],
  ["no_sign_scope", "No sign/canopy work in it"],
  ["too_small", "Too small to chase"],
  ["wrong_company", "Research got the wrong company"],
  ["has_vendor", "They already have a sign vendor"],
  ["residential_or_civic", "Residential / civic — not our buyer"],
  ["bad_timing", "Real, but timing is off"],
  ["duplicate", "Duplicate of another card"],
  ["other", "Other"],
];
export const DISMISS_REASON_LABELS = new Map(DISMISS_REASONS);
