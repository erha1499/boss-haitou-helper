import { CONFIG, getStoredJSON } from "./config.js";
import { normalizeJobTypeFilter } from "./rules/job-type.js";
import { normalizeSalaryFilter } from "./rules/salary.js";

export const state = {
  isRunning: false,
  activeRun: null,
  account: { id: "", needsReload: false, error: "", writeFailed: false, pageStartedAt: Date.now(), signalId: Math.random().toString(36).slice(2), publishedUid: "" },
  currentIndex: 0,
  jobIndexOffset: 0,
  targetCount: Math.min(parseInt(localStorage.getItem("zdlTargetCount") || CONFIG.DAILY_LIMIT.toString(), 10), CONFIG.DAILY_LIMIT),

  includeTags: getStoredJSON("includeTags", []).map((t) => typeof t === "string" ? t : t.text),
  locationTags: getStoredJSON("locationTags", []),
  salaryFilter: normalizeSalaryFilter(getStoredJSON("salaryFilter", {})),
  detailBlockedTags: getStoredJSON("detailBlockedTags", []),
  detailRequiredTags: getStoredJSON("detailRequiredTags", []),
  detailOptionalTags: getStoredJSON("detailOptionalTags", []),
  recruiterIncludeTags: getStoredJSON("zdlRecruiterIncludeTags", []),
  coarseBlockedTags: getStoredJSON("zdlCoarseBlockedTags", []),
  coarseRequiredTags: getStoredJSON("zdlCoarseRequiredTags", []),

  jobList: [],

  ui: {
    isMinimized: false,
    isPinned: getStoredJSON("panelPinned", true),
  },

  settings: {
    recruiterActivityStatus: getStoredJSON(
      "recruiterActivityStatus",
      ["在线", "刚刚活跃", "今日活跃", "3日内活跃", "本周活跃", "本月活跃", "半年前活跃", "未知"]
    ),
  },

  delivery: {
    dailyDate: "", dailyCount: 0, totalCount: 0,
  },
  machineDelivery: { dailyDate: "", dailyCount: 0, totalCount: 0 },

  logDate: localStorage.getItem("zdlLogDate") || "",
  logEntries: getStoredJSON("zdlLogEntries", []),
  deliveryHistory: getStoredJSON("zdlDeliveryHistory", {}),
  companyLogos: getStoredJSON("zdlCompanyLogos", {}),
  blockedCompanies: getStoredJSON("zdlBlockedCompanies", []),
};

export const elements = {
  panel: null,
  controlBtn: null,
  log: null,
  includeInput: null,
  locationInput: null,
  includeTagList: null,
  locationTagList: null,
  detailBlockedTagList: null,
  detailRequiredTagList: null,
  detailOptionalTagList: null,
  recruiterIncludeTagList: null,
  detailBlockedInput: null,
  detailRequiredInput: null,
  detailOptionalInput: null,
  recruiterIncludeInput: null,
  blockedCompanyInput: null,
  blockedCompanyTagList: null,
  coarseBlockedInput: null,
  coarseBlockedTagList: null,
  coarseRequiredInput: null,
  coarseRequiredTagList: null,
  miniIcon: null,
  kpiValueEl: null,
  kpiTargetEl: null,
  kpiTotalEl: null,
  kpiBarEl: null,
  accountStatusEl: null,
  accountsBtn: null,
  accountsPanel: null,
  accountsContent: null,
  pinBtn: null,
  historyBtn: null,
  targetInput: null,
  settingsBtn: null,
  settingsPanel: null,
  settingsScroll: null,
  configCopyBtn: null,
  configImportBtn: null,
  configUndoBtn: null,
  configStatus: null,
  configDialog: null,
  configInput: null,
  configPreview: null,
  configFeedback: null,
  configApplyBtn: null,
  configFallback: null,
  wizardDialog: null,
  wizardBtn: null,
  emptyRulesHint: null,
  runStatusEl: null,
  logTabs: null,
  remedyBtn: null,
};

export function saveLogEntries() {
  try {
    if (state.logEntries.length > CONFIG.MAX_LOG_ENTRIES) {
      state.logEntries.splice(0, state.logEntries.length - CONFIG.MAX_LOG_ENTRIES);
    }
    localStorage.setItem("zdlLogEntries", JSON.stringify(state.logEntries));
  } catch (e) {
    // localStorage 写入失败（存储满 / 无痕模式等），静默忽略
  }
}

state.jobTypeFilter = normalizeJobTypeFilter(getStoredJSON("zdlJobTypeFilter", null));
