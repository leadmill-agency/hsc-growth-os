import { registerPloybook } from "./registry";
import { pb00Dummy } from "./pb00-dummy/definition";
import { pb01GcPursuit } from "./pb01-gc-pursuit/definition";
import { pb05OpportunityRadar } from "./pb05-radar/definition";
import { pb09AccountResearch } from "./pb09-account-research/definition";

// Register all ploybooks. Import this module once (server startup / test setup)
// before using the runner. PB02–PB18 register here as they are built.

registerPloybook(pb00Dummy);
registerPloybook(pb01GcPursuit);
registerPloybook(pb05OpportunityRadar);
registerPloybook(pb09AccountResearch);

export * from "./types";
export * from "./registry";
export * from "./runner";
