import { describe, expect, it } from "vitest";
import { intoSendWindow } from "./send-queue";

function ct(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

describe("send window (9:00am–5:30pm Houston, weekdays)", () => {
  it("a night-time approval slides to 9:00am the next morning", () => {
    // Wed 2026-09-23 11pm CT = Thu 04:00 UTC
    const slot = intoSendWindow(new Date("2026-09-24T04:00:00Z"));
    expect(ct(slot)).toBe("Thu 09:00");
  });

  it("mid-window instants pass through unchanged", () => {
    const d = new Date("2026-09-24T16:12:00Z"); // Thu 11:12am CDT
    expect(intoSendWindow(d).getTime()).toBe(d.getTime());
  });

  it("after 5:30pm rolls to the next morning", () => {
    const slot = intoSendWindow(new Date("2026-09-24T23:45:00Z")); // Thu 6:45pm CDT
    expect(ct(slot)).toBe("Fri 09:00");
  });

  it("Friday night rolls past the weekend to Monday 9:00am", () => {
    const slot = intoSendWindow(new Date("2026-09-26T02:00:00Z")); // Fri 9pm CDT
    expect(ct(slot)).toBe("Mon 09:00");
  });
});
