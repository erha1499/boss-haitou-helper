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

// 薪资筛选按岗位类型分开：实习按日薪（元/天），校招、社招按月薪（K）。
// { intern: { min, max }, campus: { min, max }, social: { min, max }, negotiable }，留空表示不限。
export const SALARY_BANDS = [
  { key: "intern", label: "实习", unit: "元/天" },
  { key: "campus", label: "校招", unit: "K" },
  { key: "social", label: "社招", unit: "K" },
];

const cleanSalaryValue = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
};
const cleanBand = (band) => {
  let min = cleanSalaryValue(band?.min), max = cleanSalaryValue(band?.max);
  if (min && max && Number(min) > Number(max)) [min, max] = [max, min];
  return { min, max };
};

// 兼容旧格式 { type, min, max, negotiable }（不分类型，单位 K）：数值沿用到校招和社招，实习不限
export function normalizeSalaryFilter(value) {
  const negotiable = value?.negotiable !== false;
  if (value && "type" in value) {
    const min = value.type === "range" || value.type === "atLeast" ? value.min : "";
    const max = value.type === "range" || value.type === "atMost" ? value.max : "";
    const band = cleanBand({ min, max });
    return { intern: cleanBand(null), campus: { ...band }, social: { ...band }, negotiable };
  }
  return { intern: cleanBand(value?.intern), campus: cleanBand(value?.campus), social: cleanBand(value?.social), negotiable };
}

export const isSalaryBandActive = (band) => !!(band && (band.min || band.max));
export const isSalaryFilterActive = (sf, types) => {
  const f = normalizeSalaryFilter(sf);
  return f.negotiable === false || SALARY_BANDS.some(({ key }) => (!types || types.includes(key)) && isSalaryBandActive(f[key]));
};

export function formatSalaryBand(band, unit) {
  if (band.min && band.max) return `${band.min}–${band.max}${unit}`;
  if (band.min) return `${band.min}${unit}以上`;
  if (band.max) return `${band.max}${unit}以下`;
  return "不限";
}

// 日薪（元/天）：写明按天的直接取值，按月的用每月工作日折算
export function parseDailyRange(decodedText) {
  const perDay = decodedText.match(/(\d+)\s*-\s*(\d+)\s*元\/[天日]/);
  if (perDay) return { min: parseInt(perDay[1], 10), max: parseInt(perDay[2], 10) };
  const perDaySingle = decodedText.match(/(\d+)\s*元\/[天日]/);
  if (perDaySingle) return { min: parseInt(perDaySingle[1], 10), max: parseInt(perDaySingle[1], 10) };
  const monthly = parseSalaryRange(decodedText);
  if (!monthly) return null;
  return {
    min: Math.floor(monthly.min * 1000 / CONFIG.WORK_DAYS_PER_MONTH),
    max: Math.ceil(monthly.max * 1000 / CONFIG.WORK_DAYS_PER_MONTH),
  };
}

// 这个岗位该按哪几档薪资筛选。年限类和社招信号按社招；没标类型的（经验不限、看不出）校招、社招都算。
export function salaryBandsFor(result) {
  if (result?.kind === "years") return ["social"];
  if (result?.kind === "soft") {
    const keys = new Set();
    result.types.forEach((t) => (t === "open" ? ["campus", "social"].forEach((k) => keys.add(k)) : keys.add(t)));
    return [...keys];
  }
  return ["campus", "social"];
}

// result 为 classifyJob 的结果。区间有重叠就算符合；读不出薪资的、该档没设范围的不拦截。
// 命中多个类型时，任一档符合即可。
export function salaryInFilter(salaryText, salaryFilter, result) {
  const sf = normalizeSalaryFilter(salaryFilter);
  if (isNegotiableSalary(salaryText)) return sf.negotiable;
  return salaryBandsFor(result).some((key) => {
    const { min, max } = sf[key];
    if (!min && !max) return true;
    const parsed = key === "intern" ? parseDailyRange(salaryText) : parseSalaryRange(salaryText);
    if (!parsed) return true;
    return (!min || parsed.max >= Number(min)) && (!max || parsed.min <= Number(max));
  });
}
