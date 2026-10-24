import { CONFIG } from "../config.js";

export const SALARY_DECODE_MAP = {
  e031: "0", e032: "1", e033: "2", e034: "3", e035: "4",
  e036: "5", e037: "6", e038: "7", e039: "8", e03a: "9",
};

export function decodeSalary(text) {
  let result = "";
  for (const ch of text) {
    const hex = ch.codePointAt(0).toString(16).toLowerCase();
    result += SALARY_DECODE_MAP[hex] || ch;
  }
  return result;
}

export function parseSalaryRange(decodedText) {
  // 按天计薪：xxx-xxx元/天 → 折算为月薪K（按每月工作日常量，向上取整）
  const perDay = decodedText.match(/(\d+)\s*-\s*(\d+)\s*元\/[天日]/);
  if (perDay) {
    return {
      min: Math.ceil(parseInt(perDay[1], 10) * CONFIG.WORK_DAYS_PER_MONTH / 1000),
      max: Math.ceil(parseInt(perDay[2], 10) * CONFIG.WORK_DAYS_PER_MONTH / 1000),
    };
  }
  const perDaySingle = decodedText.match(/(\d+)\s*元\/[天日]/);
  if (perDaySingle) {
    const val = Math.ceil(parseInt(perDaySingle[1], 10) * CONFIG.WORK_DAYS_PER_MONTH / 1000);
    return { min: val, max: val };
  }
  // 按月计薪：xx-xxK
  const cleaned = decodedText.replace(/[Kk].*$/, "K");
  const match = cleaned.match(/(\d+)\s*-\s*(\d+)\s*[Kk]/);
  if (match) return { min: parseInt(match[1], 10), max: parseInt(match[2], 10) };
  const single = cleaned.match(/(\d+)\s*[Kk]/);
  if (single) return { min: parseInt(single[1], 10), max: parseInt(single[1], 10) };
  return null;
}

export const isNegotiableSalary = (salaryText) => /面议/.test(salaryText);

// 薪资筛选：sf 为 { type: "none" | "range" | "atLeast" | "atMost", min, max, negotiable }，单位 K。
// 区间有重叠就算符合；读不出薪资的不拦截。
export function salaryInFilter(salaryText, sf) {
  if (isNegotiableSalary(salaryText)) return sf.negotiable !== false;
  const min = (sf.type === "range" || sf.type === "atLeast") && sf.min ? parseInt(sf.min, 10) : null;
  const max = (sf.type === "range" || sf.type === "atMost") && sf.max ? parseInt(sf.max, 10) : null;
  if (min === null && max === null) return true;
  const parsed = parseSalaryRange(salaryText);
  if (!parsed) return true;
  return (min === null || parsed.max >= min) && (max === null || parsed.min <= max);
}
