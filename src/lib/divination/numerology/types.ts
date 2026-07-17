// 生命灵数（Life Path Number）計算結果型別，見 index.ts 演算法说明

export type NumerologyBirthDate = {
  /** 西元／阳历年份，本系统只处理阳历生日，无农历换算需求（与 mingyu 的八字/紫微不同） */
  year: number;
  month: number;
  day: number;
};

/** 单一部分（月／日／年）从原始数字化简到个位数或大师数的过程记录，供除错/展示用 */
export type NumerologyReduction = {
  /** 化简过程中每一步的数值，第一个元素是原始输入 */
  steps: number[];
  /** 化简后的最终值：1~9，或大师数 11／22／33 */
  value: number;
  isMasterNumber: boolean;
};

export type LifePathNumberResult = {
  lifePathNumber: number;
  isMasterNumber: boolean;
  breakdown: {
    month: NumerologyReduction;
    day: NumerologyReduction;
    year: NumerologyReduction;
    /** 三部分化简值加总，尚未做最后一次化简 */
    sumOfParts: number;
    final: NumerologyReduction;
  };
};

export class NumerologyInputError extends Error {}
