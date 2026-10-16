import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatDateTime, localOffset, parseDateTime } from "../../../../src/components/form/schema/date-time.js";

const originalZone = process.env["TZ"];
beforeAll(() => {
  process.env["TZ"] = "Europe/Brussels";
});
afterAll(() => {
  process.env["TZ"] = originalZone;
});

describe("parseDateTime", () => {
  it("takes a date-time with an offset apart", () => {
    expect(parseDateTime("2026-01-01T07:30:00+01:00")).toEqual({ date: "2026-01-01", time: "07:30:00", sign: "+", offset: "01:00" });
    expect(parseDateTime("2026-01-01T07:30-05:30")).toEqual({ date: "2026-01-01", time: "07:30", sign: "-", offset: "05:30" });
  });

  it("reads Z as an offset of zero", () => {
    expect(parseDateTime("2026-01-01T00:00:00Z")).toMatchObject({ sign: "+", offset: "00:00" });
  });

  it("gives one without an offset the reader's own for that date", () => {
    expect(parseDateTime("2026-07-01T12:00:00")).toMatchObject({ sign: "+", offset: "02:00" });
  });

  it("starts an empty field with nothing entered", () => {
    expect(parseDateTime(null)).toMatchObject({ date: "", time: "" });
  });

  it("gives nothing for what is not a date-time", () => {
    expect(parseDateTime("next tuesday")).toBeUndefined();
    expect(parseDateTime(42)).toBeUndefined();
  });
});

describe("formatDateTime", () => {
  it("puts the parts back together, with seconds", () => {
    expect(formatDateTime({ date: "2026-01-01", time: "07:30", sign: "-", offset: "05:30" })).toBe("2026-01-01T07:30:00-05:30");
    expect(formatDateTime({ date: "2026-01-01", time: "07:30:15", sign: "+", offset: "01:00" })).toBe("2026-01-01T07:30:15+01:00");
  });

  it("starts at midnight where no time is entered, and is null where no date is", () => {
    expect(formatDateTime({ date: "2026-01-01", time: "", sign: "+", offset: "01:00" })).toBe("2026-01-01T00:00:00+01:00");
    expect(formatDateTime({ date: "", time: "07:30", sign: "+", offset: "01:00" })).toBeNull();
  });
});

describe("localOffset", () => {
  it("is the reader's own offset at that time, which differs between winter and summer", () => {
    expect(localOffset("2026-01-15T12:00")).toEqual({ sign: "+", offset: "01:00" });
    expect(localOffset("2026-07-15T12:00")).toEqual({ sign: "+", offset: "02:00" });
  });
});
