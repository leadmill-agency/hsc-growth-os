import { describe, expect, it } from "vitest";
import { formatTdlrSignal, type TdlrProject } from "./client";

const row: TdlrProject = {
  ProjectId: "abc-123",
  ProjectNumber: "TABS2027000446",
  ProjectName: "Office Warehouse at Rankin",
  ProjectCreatedOn: "2026-09-07T12:00:00",
  ProjectStatus: 3008,
  FacilityName: "Office Warehouse at Rankin",
  City: 785,
  County: 2101,
  TypeOfWork: 9001,
  EstimatedCost: 10_500_000,
  EstimatedStartDate: "2026-11-01T00:00:00",
  EstimatedEndDate: null,
};

describe("TDLR signal formatting", () => {
  it("decodes city/county/status/work-type codes into a readable radar signal", () => {
    const { signalText, sourceUrl } = formatTdlrSignal(row);
    expect(signalText).toContain("TABS2027000446");
    expect(signalText).toContain("Houston, Harris County");
    expect(signalText).toContain("new construction");
    expect(signalText).toContain("$10,500,000");
    expect(signalText).toContain("Project Registered");
    expect(sourceUrl).toContain("abc-123");
  });

  it("falls back to raw codes for unknown mappings", () => {
    const { signalText } = formatTdlrSignal({ ...row, City: 42, TypeOfWork: 9099 });
    expect(signalText).toContain("city code 42");
    expect(signalText).toContain("work type 9099");
  });
});
