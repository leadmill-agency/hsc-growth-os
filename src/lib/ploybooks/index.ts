import { registerPloybook } from "./registry";
import { pb00Dummy } from "./pb00-dummy/definition";

// Register all ploybooks. Import this module once (server startup / test setup)
// before using the runner. PB01–PB18 register here as they are built.

registerPloybook(pb00Dummy);

export * from "./types";
export * from "./registry";
export * from "./runner";
