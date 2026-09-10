import { registerPloybook } from "./registry";
import { pb00Dummy } from "./pb00-dummy/definition";
import { pb01GcPursuit } from "./pb01-gc-pursuit/definition";
import { pb02CommercialDevelopment } from "./pb02-commercial-development/definition";
import { pb03FranchiseExpansion } from "./pb03-franchise-expansion/definition";
import { pb04FacilityPortfolio } from "./pb04-facility-portfolio/definition";
import { pb05OpportunityRadar } from "./pb05-radar/definition";
import { pb06CompanySwarm } from "./pb06-company-swarm/definition";
import { pb07AbmPage } from "./pb07-abm-page/definition";
import { pb08HighIntentVisitor } from "./pb08-high-intent-visitor/definition";
import { pb09AccountResearch } from "./pb09-account-research/definition";
import { pb10IncomingBid } from "./pb10-incoming-bid/definition";
import { pb11BidAnalyzer } from "./pb11-bid-analyzer/definition";
import { pb12BidQa } from "./pb12-bid-qa/definition";
import { pb13BidFollowup } from "./pb13-bid-followup/definition";
import { pb14DealRoom } from "./pb14-deal-room/definition";
import { pb15BusinessCase } from "./pb15-business-case/definition";
import { pb16LocalSeo } from "./pb16-local-seo/definition";
import { pb17ContentBuilder } from "./pb17-content-builder/definition";
import { pb18GrowthOperator } from "./pb18-growth-operator/definition";

// Register all ploybooks. Import this module once (server startup / test setup)
// before using the runner. Remaining PBs register here as they are built.

registerPloybook(pb00Dummy);
registerPloybook(pb01GcPursuit);
registerPloybook(pb02CommercialDevelopment);
registerPloybook(pb03FranchiseExpansion);
registerPloybook(pb04FacilityPortfolio);
registerPloybook(pb05OpportunityRadar);
registerPloybook(pb06CompanySwarm);
registerPloybook(pb07AbmPage);
registerPloybook(pb08HighIntentVisitor);
registerPloybook(pb09AccountResearch);
registerPloybook(pb10IncomingBid);
registerPloybook(pb11BidAnalyzer);
registerPloybook(pb12BidQa);
registerPloybook(pb13BidFollowup);
registerPloybook(pb14DealRoom);
registerPloybook(pb15BusinessCase);
registerPloybook(pb16LocalSeo);
registerPloybook(pb17ContentBuilder);
registerPloybook(pb18GrowthOperator);

export * from "./types";
export * from "./registry";
export * from "./runner";
