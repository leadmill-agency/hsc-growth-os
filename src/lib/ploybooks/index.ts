import { registerPloybook } from "./registry";
import { pb00Dummy } from "./pb00-dummy/definition";
import { pb01GcPursuit } from "./pb01-gc-pursuit/definition";
import { pb02CommercialDevelopment } from "./pb02-commercial-development/definition";
import { pb03FranchiseExpansion } from "./pb03-franchise-expansion/definition";
import { pb04FacilityPortfolio } from "./pb04-facility-portfolio/definition";
import { pb05OpportunityRadar } from "./pb05-radar/definition";
import { pb09AccountResearch } from "./pb09-account-research/definition";

// Register all ploybooks. Import this module once (server startup / test setup)
// before using the runner. Remaining PBs register here as they are built.

registerPloybook(pb00Dummy);
registerPloybook(pb01GcPursuit);
registerPloybook(pb02CommercialDevelopment);
registerPloybook(pb03FranchiseExpansion);
registerPloybook(pb04FacilityPortfolio);
registerPloybook(pb05OpportunityRadar);
registerPloybook(pb09AccountResearch);

export * from "./types";
export * from "./registry";
export * from "./runner";
