import { describe, expect, test } from "vitest";
import { formatDuration, formatTime, parseClock, spokenTime } from "@/helpers/time";

describe("time helpers", () => {
  test.each([
    ["00:01:21.024", 81.024], ["0:01:36", 96], ["2:03", 123], ["75.5", 75.5], [12, 12],
  ])("parseClock(%s)", (value, seconds) => {
    expect(parseClock(value)).toBeCloseTo(seconds as number, 3);
  });
  test.each(["", "abc", "1:2:3:4", "-1", "1:-2", null, undefined, NaN, -5, {}])("parseClock rejects %s", (value) => {
    expect(parseClock(value)).toBeNull();
  });
  test("formats clock, spoken and rounded durations", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(75.9)).toBe("1:15");
    expect(formatTime(3723)).toBe("1:02:03");
    expect(formatTime(NaN)).toBe("0:00");
    expect(spokenTime(3723)).toBe("1 hour 2 minutes 3 seconds");
    expect(spokenTime(61)).toBe("1 minute 1 second");
    expect(spokenTime(0)).toBe("0 seconds");
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(20)).toBe("1 min");
    expect(formatDuration(754)).toBe("13 min");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(4663)).toBe("1 h 18 min");
  });
});
