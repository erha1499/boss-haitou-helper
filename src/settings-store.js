import { CONFIG, RECRUITER_STATUS_OPTIONS } from "./config.js";
import { JOB_DEGREE_LABEL, JOB_TYPES, JOB_TYPE_LABEL, JOB_YEARS, JOB_YEARS_LABEL, LEGACY_JOB_TYPES, activeDegree, normalizeJobTypeFilter } from "./rules/job-type.js";
import { SALARY_BANDS, formatSalaryBand, isSalaryBandActive, normalizeSalaryFilter } from "./rules/salary.js";
import { wizardKeywordName } from "./rules/wizard.js";
import { elements, state } from "./state.js";
import { UI } from "./ui/index.js";

export function saveTags() {
  invalidateConfigUndo();
  UI._refreshFilterCounts();
  localStorage.setItem("includeTags", JSON.stringify(state.includeTags));
  localStorage.setItem("locationTags", JSON.stringify(state.locationTags));
  localStorage.setItem("detailBlockedTags", JSON.stringify(state.detailBlockedTags));
  localStorage.setItem("detailRequiredTags", JSON.stringify(state.detailRequiredTags));
  localStorage.setItem("detailOptionalTags", JSON.stringify(state.detailOptionalTags));
  localStorage.setItem("zdlRecruiterIncludeTags", JSON.stringify(state.recruiterIncludeTags));
  localStorage.setItem("zdlBlockedCompanies", JSON.stringify(state.blockedCompanies));
  localStorage.setItem("zdlCoarseBlockedTags", JSON.stringify(state.coarseBlockedTags));
  localStorage.setItem("zdlCoarseRequiredTags", JSON.stringify(state.coarseRequiredTags));
}

export const CONFIG_TAG_STORAGE_KEYS = {
  includeTags: "includeTags",
  locationTags: "locationTags",
  detailBlockedTags: "detailBlockedTags",
  detailRequiredTags: "detailRequiredTags",
  detailOptionalTags: "detailOptionalTags",
  recruiterIncludeTags: "zdlRecruiterIncludeTags",
  blockedCompanies: "zdlBlockedCompanies",
  coarseBlockedTags: "zdlCoarseBlockedTags",
  coarseRequiredTags: "zdlCoarseRequiredTags",
};

export const CONFIG_UNDO_KEY = "zdlConfigUndoV1";
export const CONFIG_STORAGE_KEYS = [...Object.values(CONFIG_TAG_STORAGE_KEYS), "zdlTargetCount", "salaryFilter", "recruiterActivityStatus", "zdlJobTypeFilter"];
export const CONFIG_FIELD_LABELS = {
  targetCount: "今日目标", salaryFilter: "薪资范围", recruiterActivityStatus: "招聘者活跃状态", jobTypeFilter: "岗位类型",
  includeTags: "职位名 · 包含任一", coarseRequiredTags: "职位名 · 必须包含", coarseBlockedTags: "职位名 · 排除",
  locationTags: "工作地", blockedCompanies: "排除公司",
  detailBlockedTags: "详情 · 排除", detailRequiredTags: "详情 · 必须包含", detailOptionalTags: "详情 · 包含任一",
  recruiterIncludeTags: "只投招聘者",
};

export let configExternalChanged = false;
// 其他标签页改了配置时由 storage 事件调用；之后本页不再写配置，避免覆盖。
export function markConfigExternalChanged() {
  configExternalChanged = true;
}
export let configUndoInvalidated = false;

export function getCurrentConfig() {
  const config = {
    targetCount: state.targetCount,
    salaryFilter: normalizeSalaryFilter(state.salaryFilter),
    recruiterActivityStatus: [...state.settings.recruiterActivityStatus],
    jobTypeFilter: { types: [...state.jobTypeFilter.types], years: [...state.jobTypeFilter.years], degree: state.jobTypeFilter.degree },
  };
  Object.keys(CONFIG_TAG_STORAGE_KEYS).forEach((key) => { config[key] = [...state[key]]; });
  return config;
}

export function exportConfig() {
  return JSON.stringify({ type: "zdl-boss-config", version: 1, config: getCurrentConfig() }, null, 2);
}

export function parseConfig(jsonText) {
  let text = String(jsonText).trim();
  const fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) text = fenced[1].trim();
  let data;
  try { data = JSON.parse(text); }
  catch (error) { throw new Error("配置文本格式不正确，请重新完整复制。"); }
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  if (!isObject(data) || data.type !== "zdl-boss-config" || data.version !== 1 || !isObject(data.config)) {
    throw new Error("不是支持的配置，请使用“复制配置”生成的内容。");
  }
  const config = data.config;
  Object.keys(CONFIG_TAG_STORAGE_KEYS).forEach((key) => {
    if (config[key] === undefined) config[key] = [];
    if (!Array.isArray(config[key]) || !config[key].every((tag) => typeof tag === "string" && tag.trim())) {
      throw new Error(`${CONFIG_FIELD_LABELS[key]}格式不正确，每个词都必须是非空文本。`);
    }
  });
  if (!Number.isInteger(config.targetCount) || config.targetCount < 1 || config.targetCount > CONFIG.DAILY_LIMIT) {
    throw new Error(`投递目标必须是 1 到 ${CONFIG.DAILY_LIMIT} 之间的整数。`);
  }
  const salary = config.salaryFilter;
  const validSalaryValue = (value) => typeof value === "string"
    && (value === "" || (value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0));
  const validBand = (band) => isObject(band) && validSalaryValue(band.min ?? "") && validSalaryValue(band.max ?? "");
  // 新格式按类型分开（intern / campus / social），旧格式是 { type, min, max }
  const validSalary = isObject(salary)
    && (salary.negotiable === undefined || typeof salary.negotiable === "boolean")
    && (salary.type !== undefined
      ? ["none", "range", "atLeast", "atMost"].includes(salary.type) && validSalaryValue(salary.min) && validSalaryValue(salary.max)
      : SALARY_BANDS.every(({ key }) => salary[key] === undefined || validBand(salary[key])));
  if (!validSalary) {
    throw new Error("薪资配置无效，请检查各类型的薪资上下限。");
  }
  const jobType = config.jobTypeFilter;
  const validKeys = (list, all, legacy = {}) => Array.isArray(list) && list.every((k) => legacy[k] || all.some(([key]) => key === k));
  if (jobType !== undefined && (!isObject(jobType) || !validKeys(jobType.types, JOB_TYPES, LEGACY_JOB_TYPES) || !validKeys(jobType.years, JOB_YEARS)
    || (jobType.degree !== undefined && jobType.degree !== "" && !JOB_DEGREE_LABEL[jobType.degree]))) {
    throw new Error("岗位类型配置无效。");
  }
  const activityOptions = RECRUITER_STATUS_OPTIONS;
  if (!Array.isArray(config.recruiterActivityStatus)
    || !config.recruiterActivityStatus.every((value) => activityOptions.includes(value))) {
    throw new Error("招聘者活跃状态配置无效。");
  }
  const normalized = {
    targetCount: config.targetCount,
    salaryFilter: normalizeSalaryFilter(salary),
    recruiterActivityStatus: [...config.recruiterActivityStatus],
    jobTypeFilter: normalizeJobTypeFilter(jobType),
  };
  Object.keys(CONFIG_TAG_STORAGE_KEYS).forEach((key) => { normalized[key] = [...config[key]]; });
  return normalized;
}

export function formatConfigValue(key, value) {
  if (key === "targetCount") return `${value} 次`;
  if (key === "salaryFilter") {
    const bands = SALARY_BANDS.filter(({ key: k }) => isSalaryBandActive(value[k]))
      .map(({ key: k, label, unit }) => `${label} ${formatSalaryBand(value[k], unit)}`);
    return `${bands.join("；") || "不限"}，${value.negotiable === false ? "不含" : "含"}面议`;
  }
  if (key === "jobTypeFilter") {
    const types = value.types.length === JOB_TYPES.length ? "全部类型" : value.types.map((k) => JOB_TYPE_LABEL[k]).join("、") || "不投任何类型";
    const years = value.types.includes("social") && value.years.length < JOB_YEARS.length
      ? `；社招 ${value.years.map((k) => JOB_YEARS_LABEL[k]).join("、") || "不投"}` : "";
    const degree = activeDegree(value) ? `；学历 ${JOB_DEGREE_LABEL[value.degree]}及以下` : "";
    return types + years + degree;
  }
  if (!value.length) return ["locationTags", "recruiterActivityStatus"].includes(key) ? "不限" : "清空";
  return value.map((keyword) => wizardKeywordName(keyword) || keyword).join("、");
}

export function getConfigChanges(config) {
  const current = getCurrentConfig();
  return Object.keys(current).filter((key) => JSON.stringify(current[key]) !== JSON.stringify(config[key]))
    .map((key) => ({ key, label: CONFIG_FIELD_LABELS[key], before: formatConfigValue(key, current[key]), after: formatConfigValue(key, config[key]) }));
}

export function getConfigStorageValues(config) {
  const values = {};
  Object.entries(CONFIG_TAG_STORAGE_KEYS).forEach(([key, storageKey]) => { values[storageKey] = JSON.stringify(config[key]); });
  values.zdlTargetCount = String(config.targetCount);
  values.salaryFilter = JSON.stringify(config.salaryFilter);
  values.recruiterActivityStatus = JSON.stringify(config.recruiterActivityStatus);
  values.zdlJobTypeFilter = JSON.stringify(config.jobTypeFilter);
  return values;
}

export function assertConfigIdle() {
  if (state.isRunning || state.activeRun) throw new Error("请先停止海投，等待任务结束后再导入或撤销。");
  if (configExternalChanged) throw new Error("其他页面已修改配置，请刷新后重试。");
}

export function writeConfig(config, undoValue) {
  const values = { ...getConfigStorageValues(config), [CONFIG_UNDO_KEY]: undoValue };
  const previous = Object.keys(values).map((key) => [key, localStorage.getItem(key)]);
  try {
    Object.entries(values).forEach(([key, value]) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    });
  } catch (error) {
    let rollbackFailed = false;
    previous.forEach(([key, value]) => {
      try {
        if (localStorage.getItem(key) === value) return;
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch (rollbackError) { rollbackFailed = true; }
    });
    throw new Error(rollbackFailed
      ? "本地存储写入及恢复失败，请检查浏览器存储权限和剩余空间。"
      : "本地存储写入失败，已保留原配置，请检查浏览器存储权限和剩余空间。");
  }
  Object.keys(CONFIG_TAG_STORAGE_KEYS).forEach((key) => {
    state[key].splice(0);
    config[key].forEach((tag) => state[key].push(tag));
  });
  state.targetCount = config.targetCount;
  state.salaryFilter = normalizeSalaryFilter(config.salaryFilter);
  state.settings.recruiterActivityStatus.splice(0);
  config.recruiterActivityStatus.forEach((value) => state.settings.recruiterActivityStatus.push(value));
  state.jobTypeFilter = normalizeJobTypeFilter(config.jobTypeFilter);
}

export function importConfig(jsonText) {
  assertConfigIdle();
  const config = parseConfig(jsonText);
  const changes = getConfigChanges(config);
  if (!changes.length) return 0;
  const undo = JSON.stringify({ version: 1, before: getCurrentConfig(), after: config });
  writeConfig(config, undo);
  configUndoInvalidated = false;
  return changes.length;
}

export function getConfigUndo() {
  if (configExternalChanged || configUndoInvalidated) return null;
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG_UNDO_KEY) || "null");
    if (!data || data.version !== 1) return null;
    const wrap = (config) => JSON.stringify({ type: "zdl-boss-config", version: 1, config });
    const before = parseConfig(wrap(data.before)), after = parseConfig(wrap(data.after));
    if (JSON.stringify(getCurrentConfig()) !== JSON.stringify(after)) return null;
    if (Object.entries(getConfigStorageValues(after)).some(([key, value]) => localStorage.getItem(key) !== value)) return null;
    return { before, after };
  } catch (error) { return null; }
}

export function canUndoConfigImport() {
  return !state.isRunning && !state.activeRun && !!getConfigUndo();
}

export function undoConfigImport() {
  assertConfigIdle();
  const undo = getConfigUndo();
  if (!undo) throw new Error("配置已修改，或没有可撤销的导入。");
  writeConfig(undo.before, null);
}

export function invalidateConfigUndo() {
  configUndoInvalidated = true;
  try { localStorage.removeItem(CONFIG_UNDO_KEY); } catch (error) {}
  if (elements.configImportBtn) {
    elements.configFallback.hidden = true;
    UI._setConfigStatus("");
    UI._updateConfigControls();
  }
}
