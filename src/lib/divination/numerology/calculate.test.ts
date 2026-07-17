import { describe, expect, it } from "vitest";

import { calculateLifePathNumber } from "./calculate";
import { NumerologyInputError } from "./types";

describe("calculateLifePathNumber", () => {
  it("reduces a plain date to a single-digit life path number", () => {
    // 1990-07-15：月 7（本身个位数）／日 15→6／年 1990→1+9+9+0=19→1+9=10→1+0=1
    // 三段加总 7+6+1=14→1+4=5
    const result = calculateLifePathNumber({ year: 1990, month: 7, day: 15 });
    expect(result.lifePathNumber).toBe(5);
    expect(result.isMasterNumber).toBe(false);
    expect(result.breakdown.year.value).toBe(1);
    expect(result.breakdown.day.value).toBe(6);
  });

  it("keeps a master number when the summed parts land exactly on 11/22/33", () => {
    // 月 9／日 9／年 1912→1+9+1+2=13→1+3=4，三段加总 9+9+4=22（大师数，直接停止不再化简）
    const result = calculateLifePathNumber({ year: 1912, month: 9, day: 9 });
    expect(result.lifePathNumber).toBe(22);
    expect(result.isMasterNumber).toBe(true);
    expect(result.breakdown.final.steps).toEqual([22]);
  });

  it("treats an 11-valued month/day as an intermediate master number that can still get diluted by the final sum", () => {
    // 月 11（本身即大师数，不再化简）／日 1／年 2000→2+0+0+0=2
    // 三段加总 11+1+2=14→1+4=5（最终结果非大师数，符合惯例：中途大师数不保证最终仍是大师数）
    const result = calculateLifePathNumber({ year: 2000, month: 11, day: 1 });
    expect(result.breakdown.month.isMasterNumber).toBe(true);
    expect(result.breakdown.month.value).toBe(11);
    expect(result.lifePathNumber).toBe(5);
    expect(result.isMasterNumber).toBe(false);
  });

  it("rejects calendar-impossible dates", () => {
    expect(() => calculateLifePathNumber({ year: 2026, month: 2, day: 30 })).toThrow(
      NumerologyInputError,
    );
  });
});
