import { NumerologyInputError } from "./types";
import type { LifePathNumberResult, NumerologyBirthDate, NumerologyReduction } from "./types";

const MASTER_NUMBERS = [11, 22, 33];

function digitSum(n: number): number {
  return String(Math.abs(n))
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0);
}

/**
 * 反复加总数字位数，直到剩个位数或命中大师数（11／22／33）就停止——大师数本身 >9，
 * 但依生命灵数惯例视为已化简完成，不再继续拆解。
 */
function reduce(n: number): NumerologyReduction {
  const steps = [n];
  let current = n;
  while (current > 9 && !MASTER_NUMBERS.includes(current)) {
    current = digitSum(current);
    steps.push(current);
  }
  return { steps, value: current, isMasterNumber: MASTER_NUMBERS.includes(current) };
}

function assertValidBirthDate(birthDate: NumerologyBirthDate): void {
  const { year, month, day } = birthDate;
  const parsed = new Date(year, month - 1, day);
  const isRealCalendarDate =
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  if (!isRealCalendarDate) {
    throw new NumerologyInputError(`不是有效的阳历日期：${year}-${month}-${day}`);
  }
}

/**
 * 生命灵数（Life Path Number）标准三段式算法：月／日／年分别化简到个位数或大师数后加总，
 * 加总结果再化简一次得到最终生命灵数。规则单纯，无需对接 mingyu／hdkit，见
 * rules/architecture.md「命理引擎（灵数）」列。
 */
export function calculateLifePathNumber(birthDate: NumerologyBirthDate): LifePathNumberResult {
  assertValidBirthDate(birthDate);

  const month = reduce(birthDate.month);
  const day = reduce(birthDate.day);
  const year = reduce(birthDate.year);
  const sumOfParts = month.value + day.value + year.value;
  const final = reduce(sumOfParts);

  return {
    lifePathNumber: final.value,
    isMasterNumber: final.isMasterNumber,
    breakdown: { month, day, year, sumOfParts, final },
  };
}
