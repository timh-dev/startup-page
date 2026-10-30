import { describe, expect, it } from "vitest";
import { usAqi } from "./aqi";

describe("usAqi", () => {
  it("follows the EPA breakpoints", () => {
    expect(usAqi(0, 0)).toBe(0);
    expect(usAqi(9.0, 0)).toBe(50);
    expect(usAqi(35.4, 0)).toBe(100);
    expect(usAqi(12, 0)).toBe(56);
    expect(usAqi(0, 154)).toBe(100);
  });

  it("takes the worse of PM2.5 and PM10", () => {
    expect(usAqi(5, 200)).toBe(usAqi(0, 200));
    expect(usAqi(60, 20)).toBe(usAqi(60, 0));
  });

  it("caps off the top of the scale", () => {
    expect(usAqi(900, null)).toBe(500);
  });
});
