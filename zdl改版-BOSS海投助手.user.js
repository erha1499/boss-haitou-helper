// ==UserScript==
// @name         boss海投助手
// @namespace    https://github.com/erha1499
// @version      2.2.0
// @description  BOSS 直聘批量筛选与自动沟通：岗位类型、关键词、薪资、招聘者多层筛选，实时预览筛选结果。安装后打开 BOSS 直聘「职位」页使用
// @author       erha1499
// @match        https://www.zhipin.com/*
// @grant        none
// @run-at       document-idle
// @supportURL   https://github.com/erha1499/boss-haitou-helper/issues
// @homepageURL  https://github.com/erha1499/boss-haitou-helper
// @license      AGPL-3.0-or-later
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjNWI4Y2ZmIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMWY0ZmQ2Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTUiIGZpbGw9InVybCgjZykiLz48cGF0aCBkPSJNMTMgMzEuNSA1MSAxNSA0Mi41IDQ1LjUgMzIuNSAzNy41WiIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0zMi41IDM3LjUgNTEgMTUgMjggMzQuNSAyOSA0NFoiIGZpbGw9IiNjZmRjZmYiLz48cGF0aCBkPSJNMTEgNTIuNWM0LjMtMy42IDguNy0zLjYgMTMgMHM4LjcgMy42IDEzIDAgOC43LTMuNiAxMyAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMy4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9Ii44NSIvPjwvc3ZnPgo=
// @updateURL    https://raw.githubusercontent.com/erha1499/boss-haitou-helper/main/boss-haitou-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/erha1499/boss-haitou-helper/main/boss-haitou-helper.user.js
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    BASIC_INTERVAL: 1000,
    OPERATION_INTERVAL: 1200,
    DAILY_LIMIT: 150,
    WORK_DAYS_PER_MONTH: 24,

    MAX_LOG_ENTRIES: 100,
    DETAIL_TIMEOUT: 8000,
  };

  const JOBS_PAGE_URL = "https://www.zhipin.com/web/geek/jobs?ka=header-jobs";
  const REPO_URL = "https://github.com/erha1499/boss-haitou-helper";
  const isJobsPage = () => /^\/web\/geek\/jobs(?:\/|$)/.test(location.pathname);

  const getStoredJSON = (key, defaultValue) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
      console.error(`Error parsing ${key}:`, e);
      return defaultValue;
    }
  };

  const RECRUITER_STATUS_OPTIONS = ["在线", "刚刚活跃", "今日活跃", "3日内活跃", "本周活跃", "本月活跃", "半年前活跃", "未知"];

  // 脚本读取 BOSS 页面时用到的选择器和按钮文字都在这里。BOSS 改版后先改这一个文件。
  // 自检（self-check.js）也按这里的定义检查页面。
  const BOSS = {
    // 左侧职位列表卡片
    jobCard: "li.job-card-box",
    cardTitle: ".job-name",
    cardCompany: ".boss-name",
    cardAddress: [".job-address-desc", ".company-location", ".job-area"], // 按顺序取第一个找到的
    cardSalary: ".job-salary",
    cardLogo: ".boss-logo img",
    cardBadgeIcon: ".job-tag-icon", // alt 含“猎头”的是猎头岗位
    cardTags: ".tag-list li",
    cardLink: "a[href*='job_detail']",

    // 右侧职位详情
    detailDesc: ".job-detail-body .desc",
    detailRoot: ".job-detail-container, .job-detail-box",
    detailTitle: ".job-name",
    detailTags: ".tag-list li", // 经验、学历
    detailSkillTags: ".job-label-list li",
    recruiterOnline: ".boss-online-tag",
    recruiterActive: ".boss-active-time",
    recruiterTitle: ".boss-info-attr",
    chatButton: "a.op-btn-chat",
    chatButtonNew: "立即沟通",
    chatButtonContacted: "继续沟通",

    // 点“立即沟通”后的弹窗
    limitDialog: ".chat-block-dialog",
    limitDialogBody: ".chat-block-body",
    limitReachedTexts: ["150", "休息一下", "无法进行沟通"], // 弹窗正文含其一表示今日已达上限
    dialogConfirm: ".default-btn.sure-btn",
    dialogCancel: ".default-btn.cancel-btn",
    stayOnPageText: "留在此页", // 投递成功弹窗里的按钮
  };

  function cleanDesc(descElement) {
    if (!descElement) return "";
    // BOSS 会在描述里插入隐藏的干扰文字（如“现场<span>kanzhun</span>面试”），
    // 它们的隐藏样式写在描述内嵌的 <style> 里。先按样式找出这些元素整个删掉，再去掉 style 本身。
    const clone = descElement.cloneNode(true);
    const hiddenClasses = new Set();
    clone.querySelectorAll("style").forEach((style) => {
      const rules = style.textContent.match(/\.[\w-]+\s*\{[^}]*\}/g) || [];
      rules.forEach((rule) => {
        if (/display\s*:\s*none|visibility\s*:\s*hidden|width\s*:\s*0\.\d+px|font-size\s*:\s*0(?![.\d])/i.test(rule)) {
          hiddenClasses.add(rule.slice(1, rule.indexOf("{")).trim());
        }
      });
      style.remove();
    });
    clone.querySelectorAll("[class]").forEach((el) => {
      if ([...el.classList].some((cls) => hiddenClasses.has(cls))) el.remove();
    });
    clone.querySelectorAll("[style]").forEach((el) => {
      if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(el.getAttribute("style"))) el.remove();
    });
    let text = clone.textContent;
    // 兜底：样式规则变了时，仍去掉常见的干扰词（大小写不敏感），长模式优先
    text = text.replace(/来自\s*boss\s*直聘/gi, "");
    text = text.replace(/来自\s*boss/gi, "");
    text = text.replace(/boss\s*直聘/gi, "");
    text = text.replace(/\bboss\b|kanzhun/gi, "");
    text = text.replace(/直聘/g, "");
    // 去除换行、回车、制表符，压缩连续空白
    text = text.replace(/[\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    return text;
  }

  const NOT_DETAIL = `${BOSS.jobCard}, #boss-pro-panel, .zdl-settings-panel, .zdl-history-panel`;

  function getDetailRoot() {
    return document.querySelector(BOSS.detailDesc)?.closest(BOSS.detailRoot) || document;
  }

  // 优先在右侧详情区域里找；找不到时在整页找，但排除左侧列表卡片和脚本自己的面板。
  function findInDetail(selector) {
    const root = getDetailRoot();
    const inRoot = root !== document ? root.querySelector(selector) : null;
    return inRoot || Array.from(document.querySelectorAll(selector)).find((el) => !el.closest(NOT_DETAIL)) || null;
  }

  function highlightCard(card) {
    document.querySelectorAll(".zdl-current-card").forEach((el) => el.classList.remove("zdl-current-card"));
    card?.classList.add("zdl-current-card");
  }

  // 页面自检：BOSS 改版后选择器可能失效，这时脚本会静默跳过所有岗位，或者一直点沟通却不计数。
  // 这里在开始投递前检查职位列表，并在投递中发现连续卡在同一步时停下来。

  const FEEDBACK = "如果页面看起来正常，可能是 BOSS 改版了，请到 GitHub 反馈";

  // 开始投递前：用列表前几个卡片读出的信息判断页面结构是否还认得。
  // infos 为 readCardInfo 的结果数组。errors 不为空时不启动；warnings 只在日志里提醒。
  function checkJobCards(infos) {
    if (!infos.length) {
      return { errors: [`当前页没有找到职位卡片。请等列表加载出来后再开始；${FEEDBACK}`], warnings: [] };
    }
    const none = (field) => infos.every((info) => !info[field]);
    const errors = [];
    const warnings = [];
    if (none("title")) errors.push(`读不到职位名，无法按规则筛选。${FEEDBACK}`);
    if (none("jobId")) warnings.push("读不到岗位链接，已沟通过的岗位可能会被重复点开");
    if (none("company")) warnings.push("读不到公司名，「排除公司」暂时不生效");
    if (none("salary")) warnings.push("读不到薪资，薪资筛选暂时不生效");
    return { errors, warnings };
  }

  // 投递中：同一步连续失败到 limit 次就该停下来。某一步成功一次，该步的计数清零。
  const STREAK_LIMIT = 3;
  const STREAK_MESSAGES = {
    detail: "连续 3 个岗位详情加载超时",
    chat: "连续 3 个岗位找不到沟通按钮",
    confirm: "连续 3 次点了沟通，但没有确认投递成功",
  };

  function createStreakGuard(limit = STREAK_LIMIT) {
    const counts = {};
    return {
      // 返回 true 表示已连续失败到上限
      fail(step) {
        counts[step] = (counts[step] || 0) + 1;
        return counts[step] >= limit;
      },
      ok(step) {
        counts[step] = 0;
      },
    };
  }

  const streakStopMessage = (step) =>
    `页面检查异常：${STREAK_MESSAGES[step]}，已自动停止。可能是网络问题，也可能是 BOSS 改版了；确认页面正常后可重新开始，一直出现请到 GitHub 反馈`;

  // 记录各账号已沟通过的岗位 id，下次直接在粗筛阶段跳过，不再逐个点开。
  const CONTACTED_JOBS_KEY = "zdlContactedJobsV1";
  const CONTACTED_JOBS_LIMIT = 3000;
  const ContactedJobs = {
    idOf(card) {
      const href = card.querySelector(BOSS.cardLink)?.getAttribute("href") || "";
      return href.match(/job_detail\/([^./?#]+)/)?.[1] || "";
    },

    _read() {
      try {
        const data = JSON.parse(localStorage.getItem(CONTACTED_JOBS_KEY) || "{}");
        return data && typeof data === "object" && !Array.isArray(data) ? data : {};
      } catch (error) {
        return {};
      }
    },

    setFor(uid) {
      const ids = this._read()[uid];
      return new Set(Array.isArray(ids) ? ids : []);
    },

    add(uid, jobId) {
      if (!uid || !jobId) return;
      const data = this._read();
      const ids = Array.isArray(data[uid]) ? data[uid] : [];
      if (ids.includes(jobId)) return;
      ids.push(jobId);
      data[uid] = ids.slice(-CONTACTED_JOBS_LIMIT);
      try { localStorage.setItem(CONTACTED_JOBS_KEY, JSON.stringify(data)); } catch (error) {}
    },
  };

  // ---------- 岗位类型与经验 ----------
  // BOSS 的经验标签只有“在校生/应届生/经验不限/1年以内/1-3年/…”，没有“实习”，
  // 所以综合卡片标签、职位名和职位描述来判断。
  const JOB_TYPES = [["intern", "实习"], ["campus", "校招/应届"], ["social", "社招"], ["open", "经验不限/未标明"]];
  const JOB_YEARS = [["y0_1", "1年以内"], ["y1_3", "1-3年"], ["y3_5", "3-5年"], ["y5p", "5年以上"], ["none", "未写年限"]];
  const JOB_TYPE_LABEL = Object.fromEntries(JOB_TYPES);
  const JOB_YEARS_LABEL = Object.fromEntries(JOB_YEARS);
  // 日志里显示的具体类型名（“经验不限”和“未标明”在筛选上是同一档，显示时区分开）
  const JOB_SIGNAL_LABEL = { intern: "实习", campus: "校招/应届", social: "社招", open: "经验不限" };
  const LEGACY_JOB_TYPES = { any: "open", unknown: "open" };

  function normalizeJobTypeFilter(value) {
    const pick = (list, all, legacy = {}) => {
      if (!Array.isArray(list)) return all.map(([k]) => k);
      const mapped = list.map((k) => legacy[k] || k);
      return all.map(([k]) => k).filter((k) => mapped.includes(k));
    };
    return { types: pick(value?.types, JOB_TYPES, LEGACY_JOB_TYPES), years: pick(value?.years, JOB_YEARS) };
  }

  const CN_DIGITS = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  function parseYearNumber(text) {
    if (/^\d+$/.test(text)) return Number(text);
    if (text.length === 1) return CN_DIGITS[text] ?? NaN;
    if (text[0] === "十") return 10 + (CN_DIGITS[text[1]] ?? NaN);
    if (text[1] === "十") return (CN_DIGITS[text[0]] ?? NaN) * 10;
    return NaN;
  }
  const yearsBucket = (n) => (n < 1 ? "y0_1" : n < 3 ? "y1_3" : n < 5 ? "y3_5" : "y5p");

  // 命中位置前面紧挨着否定词时不算，比如“不接受实习生”“非应届”“不设实习期”
  const isNegated = (text, index) => /(不接受|不招收?|不要求?|不考虑|不需要|不设|不提供|无需|不是|非)$/.test(text.slice(Math.max(0, index - 5), index));
  // 命中位置后面跟着“优先/加分”等，说明只是加分项，不是硬性要求
  const isPreferred = (text, end) => /^[^，,。；;！!\n]{0,4}?(?:者|的)?(?:优先|更佳|为佳|最佳|加分|更好)/.test(text.slice(end, end + 10));
  function findSignal(text, regex, guard) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text))) {
      if (!isNegated(text, match.index) && !(guard && guard(text, match))) return match;
    }
    return null;
  }

  const N = "(\\d{1,2}|[一二两三四五六七八九十]{1,2})";
  const JT_TITLE_INTERN = /实习|(?<![a-z])intern(?:ship)?s?(?![a-z])/gi;
  const JT_CAMPUS = /应届(?:毕业)?生?|校园招聘|校招|秋招|春招|管培生?|毕业生|(?<!\d)(?:20)?\d{2}\s*届/g;
  // “每周5天”可能是正式岗的作息，只认“至少/不少于/到岗 N 天”或每周 1-4 天
  const JT_DESC_INTERN = /实习(?:期|生|岗|时长|周期|时间)|(?:每周|一周)(?:至少|不少于|到岗|出勤)\s*[\d一二三四五六]\s*天|(?:每周|一周)\s*[1-4一二三四]\s*天|可转正|转正机会|转正实习/g;
  const JT_SOCIAL = /社招|社会招聘/g;
  const JT_OPEN = /(?:工作)?经验不限|无需(?:工作)?经验|不限(?:工作)?经验|无(?:工作)?经验要求|接受(?:无经验|零基础)/g;
  // “3年以上Java开发经验”“1-3年工作经验”“两年及以上相关经验”“3年+经验”
  const JT_YEARS = new RegExp(`(?<![\\d.])${N}\\s*\\+?\\s*(?:[-~～至到]\\s*${N}\\s*)?年\\s*\\+?(?:及|或)?(以上|以下|以内|左右)?(?:的)?([^，,。；;！!、\\n]{0,10}?)经验`, "g");
  // “经验3年以上”“经验要求：3-5年”“工作年限：3年以上”
  const JT_YEARS_AFTER = new RegExp(`(?:经验|工作年限|从业年限)(?:要求)?\\s*[:：]?\\s*${N}\\s*(?:[-~～至到]\\s*${N}\\s*)?年(以上|及以上|左右)?`, "g");

  function snippetAt(text, index, length, radius = 10) {
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + length + radius);
    return `${start > 0 ? "…" : ""}${text.slice(start, index).trimStart()}「${text.slice(index, index + length)}」`
      + `${text.slice(index + length, end).trimEnd()}${end < text.length ? "…" : ""}`;
  }

  function descYearsRequirement(desc) {
    let best = null;
    const consider = (n, match, upperBound) => {
      if (!Number.isFinite(n) || n > 15) return;
      if (isNegated(desc, match.index) || isPreferred(desc, match.index + match[0].length)) return;
      if (upperBound) {
        if (n > 1) return; // “3年以下经验”只是上限，不当作硬性要求
        n = 0;
      }
      if (!best || n > best.years) best = { years: n, evidence: `详情：${snippetAt(desc, match.index, match[0].length)}` };
    };
    let match;
    JT_YEARS.lastIndex = 0;
    while ((match = JT_YEARS.exec(desc))) {
      if (/实习|在校|校园/.test(match[4] || "")) continue; // “1年以上实习经验”说的是对候选人的要求
      consider(parseYearNumber(match[1]), match, match[3] === "以下" || match[3] === "以内");
    }
    JT_YEARS_AFTER.lastIndex = 0;
    while ((match = JT_YEARS_AFTER.exec(desc))) consider(parseYearNumber(match[1]), match, false);
    return best;
  }

  // 返回 { kind: "years" | "soft" | "unknown", label, evidence, bucket?, types? }
  // years：写明了年限要求，属于硬性条件；soft：实习/校招/经验不限/社招等类型信号，命中任一勾选项即可。
  function classifyJob({ title = "", tags = [], desc = "", salary = "" }) {
    const soft = new Map();
    const addSoft = (type, evidence) => { if (!soft.has(type)) soft.set(type, evidence); };
    // 按天计薪（如“200-300元/天”）基本是实习岗，很多实习岗职位名里并不写“实习”
    if (/元\s*\/\s*[天日]/.test(salary)) addSoft("intern", `薪资「${salary}」`);
    let cardYears = null;
    tags.map((t) => t.trim()).forEach((tag) => {
      if (/^(在校|应届|在校\/应届|在校生|应届生|应届毕业生)$/.test(tag)) addSoft("campus", `标签「${tag}」`);
      else if (tag === "经验不限") addSoft("open", `标签「${tag}」`);
      else if (/^\d+\s*天\/周$/.test(tag)) addSoft("intern", `标签「${tag}」`);
      else if (/^1年以[内下]$/.test(tag)) cardYears = { years: 0, evidence: `标签「${tag}」` };
      else {
        const m = tag.match(/^(\d+)\s*-\s*\d+\s*年$/) || tag.match(/^(\d+)\s*年以上$/);
        if (m) cardYears = { years: Number(m[1]), evidence: `标签「${tag}」` };
      }
    });
    // “x个月”标签可能是实习周期，也可能是短期项目，只在没有写年限时当作实习信号
    const monthTag = tags.find((t) => /^\d+\s*个月$/.test(t.trim()));
    if (monthTag && !cardYears) addSoft("intern", `标签「${monthTag.trim()}」`);
    if (findSignal(title, JT_TITLE_INTERN)) addSoft("intern", `职位名「${title}」`);
    if (findSignal(title, JT_CAMPUS)) addSoft("campus", `职位名「${title}」`);
    let descYears = null;
    if (desc) {
      const notProbation = (text, m) => /试用期/.test(text.slice(Math.max(0, m.index - 12), m.index));
      [["intern", JT_DESC_INTERN, notProbation], ["campus", JT_CAMPUS], ["social", JT_SOCIAL], ["open", JT_OPEN]].forEach(([type, regex, guard]) => {
        const hit = findSignal(desc, regex, guard);
        if (hit) addSoft(type, `详情：${snippetAt(desc, hit.index, hit[0].length)}`);
      });
      descYears = descYearsRequirement(desc);
    }
    const internStrong = soft.has("intern");
    // BOSS 的实习岗经验一栏常写“在校/应届”，有实习信号时按实习处理
    if (internStrong) soft.delete("campus");
    // 卡片“1年以内”对实习岗只是默认值，不当作年限要求
    const hard = [internStrong && cardYears?.years < 1 ? null : cardYears, descYears]
      .filter(Boolean).sort((x, y) => y.years - x.years)[0];
    if (hard) {
      const bucket = yearsBucket(hard.years);
      return { kind: "years", bucket, label: `社招·${JOB_YEARS_LABEL[bucket]}`, evidence: hard.evidence };
    }
    if (soft.size > 1) soft.delete("open");
    if (soft.size) {
      const types = [...soft.keys()];
      return { kind: "soft", types, label: types.map((t) => JOB_SIGNAL_LABEL[t]).join("/"), evidence: soft.get(types[0]) };
    }
    return { kind: "unknown", label: "未标明", evidence: "" };
  }

  // filter 为 normalizeJobTypeFilter 的结果：{ types: [...], years: [...] }
  const isJobTypeFilterActive = (filter) => filter.types.length < JOB_TYPES.length
    || (filter.types.includes("social") && filter.years.length < JOB_YEARS.length);

  function jobTypeMatches(result, { types, years }) {
    if (result.kind === "years") return types.includes("social") && years.includes(result.bucket);
    if (result.kind === "soft") {
      return result.types.some((t) => (t === "social" ? types.includes("social") && years.includes("none") : types.includes(t)));
    }
    return types.includes("open");
  }

  const state = {
    isRunning: false,
    activeRun: null,
    account: { id: "", needsReload: false, error: "", writeFailed: false, pageStartedAt: Date.now(), signalId: Math.random().toString(36).slice(2), publishedUid: "" },
    currentIndex: 0,
    jobIndexOffset: 0,
    targetCount: Math.min(parseInt(localStorage.getItem("zdlTargetCount") || CONFIG.DAILY_LIMIT.toString(), 10), CONFIG.DAILY_LIMIT),

    includeTags: getStoredJSON("includeTags", []).map((t) => typeof t === "string" ? t : t.text),
    locationTags: getStoredJSON("locationTags", []),
    salaryFilter: { type: "none", min: "", max: "", negotiable: true, ...getStoredJSON("salaryFilter", {}) },
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

  const elements = {
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
  };

  function saveLogEntries() {
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

  // 投递中的状态：面板里“开始投递”下面的状态行，以及网页标签的标题。
  // 切到别的标签页时也能从标题看到进度；投递结束后标题提示结果，回到这个页面几秒后恢复。

  const TITLE_TAG = /^【[^】]*】/;
  let clearTitleTimer = 0;
  let clearTitleOnVisible = null;

  function setTitleTag(tag) {
    const base = document.title.replace(TITLE_TAG, "");
    document.title = tag ? `【${tag}】${base}` : base;
  }

  const RunStatus = {
    activity: "",

    // 正在做什么，比如“正在加载岗位列表…”“正在看：某某科技 · Java开发”
    setActivity(text) {
      this.activity = text;
      this.render();
    },

    render() {
      const el = elements.runStatusEl;
      const run = state.activeRun;
      const running = !!run?.started && state.isRunning;
      if (el) {
        el.hidden = !running;
        if (running) {
          const skipped = Object.values(run.skips).reduce((sum, n) => sum + n, 0);
          el.querySelector(".zdl-run-count").textContent = `本次已投 ${run.delivered} · 跳过 ${skipped}`;
          el.querySelector(".zdl-run-activity").textContent = this.activity;
          el.querySelector(".zdl-run-activity").title = this.activity;
        }
      }
      if (running) {
        this._stopTitleCleanup();
        setTitleTag(`投递中 ${state.delivery.dailyCount}/${state.targetCount}`);
      }
    },

    // 投递结束：result 为“投递完成”“已停止”“投递异常”
    finish(result) {
      this.activity = "";
      this.render();
      setTitleTag(result);
      this._stopTitleCleanup();
      const clearLater = () => {
        clearTitleTimer = setTimeout(() => setTitleTag(""), 8000);
      };
      if (!document.hidden) {
        clearLater();
        return;
      }
      clearTitleOnVisible = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", clearTitleOnVisible);
        clearTitleOnVisible = null;
        clearLater();
      };
      document.addEventListener("visibilitychange", clearTitleOnVisible);
    },

    _stopTitleCleanup() {
      clearTimeout(clearTitleTimer);
      if (clearTitleOnVisible) document.removeEventListener("visibilitychange", clearTitleOnVisible);
      clearTitleOnVisible = null;
    },
  };

  const UI_ICONS = {
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 1.8-2.5 3.5M12 16.5h.01"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-3 4v2h10v-2l-3-4V3M12 15v6"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    github: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.1-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2.2"/></svg>',
    wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 20 10-10M14 4v2M14 12v2M10 8h2M18 8h2M17 5l1-1M17 11l1 1"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h5m4 0h7M4 17h7m4 0h5"/><circle cx="11" cy="7" r="2"/><circle cx="13" cy="17" r="2"/></svg>',
  };

  const SVG_ICON = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;fill:white;"><path d="M512 116.032a160 160 0 0 1 52.224 311.232v259.008c118.144-22.272 207.552-121.088 207.552-239.36 0-25.152 21.568-45.568 48.128-45.568 26.624 0 48.128 20.416 48.128 45.632 0 184.832-158.848 335.232-354.048 335.232S160 631.808 160 446.976c0-25.152 21.568-45.632 48.128-45.632 26.624 0 48.128 20.48 48.128 45.632 0 118.144 89.088 216.96 206.976 239.296V428.416A160.064 160.064 0 0 1 512 116.032z m0 96a64 64 0 1 0 0 128 64 64 0 0 0 0-128z m-36.672 668.48l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.952 19.584a56.32 56.32 0 0 1-77.504 0l-21.952-19.584a17.92 17.92 0 0 0-24.64 0l-28.288 25.6c-9.6 8.704-23.36 6.4-30.72-4.992a29.696 29.696 0 0 1 4.16-36.672l28.352-25.6a56.32 56.32 0 0 1 77.568 0l21.888 19.584a17.92 17.92 0 0 0 24.704 0l21.824-19.52a56.32 56.32 0 0 1 77.568 0l21.888 19.52a17.92 17.92 0 0 0 24.64 0l21.952-19.52a56.32 56.32 0 0 1 77.504 0l21.952 19.52a17.92 17.92 0 0 0 24.64 0l21.824-19.52a56.32 56.32 0 0 1 77.632 0l21.824 19.52c9.664 8.704 11.52 25.152 4.224 36.672-7.296 11.52-21.12 13.696-30.72 4.992l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.888 19.584a56.32 56.32 0 0 1-77.568 0l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.888 19.584a57.408 57.408 0 0 1-38.656 15.488 58.176 58.176 0 0 1-38.784-15.488z"/></svg>`;

  // 英文按整词匹配：关键词边缘是字母时，紧挨着的字符不能也是字母（java 不匹配 javascript），
  // 中文不受影响。允许复数 s（agent 匹配 agents）；末尾加 * 表示前缀（spring* 匹配 springboot）。
  // 关键词支持正则，不是合法正则时按普通文字匹配（如 c++）。
  const LETTER_EDGE = "(?:(?<![a-z])|(?![a-z]))";
  const keywordRegexCache = new Map();

  // 按顶层的 | 拆开（括号、方括号里的不拆），这样“hr*|招聘|人事”里的 * 只作用于 hr
  function splitAlternatives(source) {
    const parts = [];
    let depth = 0, inClass = false, start = 0;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (ch === "\\") { i++; continue; }
      if (inClass) { if (ch === "]") inClass = false; continue; }
      if (ch === "[") inClass = true;
      else if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "|" && depth === 0) { parts.push(source.slice(start, i)); start = i + 1; }
    }
    parts.push(source.slice(start));
    return parts;
  }

  // 每一段：末尾是“字母/数字 + *”时按前缀匹配，否则按整词匹配（允许复数 s）
  const alternativeSource = (alt) => (/[a-z0-9]\*$/i.test(alt)
    ? `(?:${alt.slice(0, -1)})`
    : `(?:${alt})s?${LETTER_EDGE}`);

  function keywordRegex(keyword) {
    let regex = keywordRegexCache.get(keyword);
    if (regex) return regex;
    const build = (source) => new RegExp(`${LETTER_EDGE}(?:${splitAlternatives(source).map(alternativeSource).join("|")})`, "i");
    const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const valid = (text) => { try { new RegExp(text); return true; } catch (error) { return false; } };
    try {
      regex = build(keyword);
    } catch (error) {
      // 只把写错的那一段当普通文字，比如“c++|java”里的 c++
      try {
        regex = build(splitAlternatives(keyword).map((alt) => (valid(alt) ? alt : escape(alt))).join("|"));
      } catch (error2) {
        regex = build(escape(keyword));
      }
    }
    keywordRegexCache.set(keyword, regex);
    return regex;
  }

  function matchKeyword(text, keyword) {
    return keywordRegex(keyword).test(text);
  }

  // 截取关键词命中处前后的一小段原文，命中部分用「」标出，方便在日志里核对误伤。
  function keywordSnippet(text, keyword, radius = 10) {
    const match = keywordRegex(keyword).exec(text);
    if (!match) return "";
    const start = Math.max(0, match.index - radius);
    const end = Math.min(text.length, match.index + match[0].length + radius);
    const before = text.slice(start, match.index).trimStart();
    const after = text.slice(match.index + match[0].length, end).trimEnd();
    return `${start > 0 ? "…" : ""}${before}「${match[0]}」${after}${end < text.length ? "…" : ""}`;
  }

  const SALARY_DECODE_MAP = {
    e031: "0", e032: "1", e033: "2", e034: "3", e035: "4",
    e036: "5", e037: "6", e038: "7", e039: "8", e03a: "9",
  };

  function decodeSalary(text) {
    let result = "";
    for (const ch of text) {
      const hex = ch.codePointAt(0).toString(16).toLowerCase();
      result += SALARY_DECODE_MAP[hex] || ch;
    }
    return result;
  }

  function parseSalaryRange(decodedText) {
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

  const isNegotiableSalary = (salaryText) => /面议/.test(salaryText);

  // 薪资筛选：sf 为 { type: "none" | "range" | "atLeast" | "atMost", min, max, negotiable }，单位 K。
  // 区间有重叠就算符合；读不出薪资的不拦截。
  function salaryInFilter(salaryText, sf) {
    if (isNegotiableSalary(salaryText)) return sf.negotiable !== false;
    const min = (sf.type === "range" || sf.type === "atLeast") && sf.min ? parseInt(sf.min, 10) : null;
    const max = (sf.type === "range" || sf.type === "atMost") && sf.max ? parseInt(sf.max, 10) : null;
    if (min === null && max === null) return true;
    const parsed = parseSalaryRange(salaryText);
    if (!parsed) return true;
    return (min === null || parsed.max >= min) && (max === null || parsed.min <= max);
  }

  // 粗筛阶段只能看卡片：只有写明年限且不在范围内才排除，其余留到详情再判断
  function coarseJobTypeRejectBy(info, jobTypeFilter) {
    if (!isJobTypeFilterActive(jobTypeFilter)) return null;
    const result = classifyJob({ title: info.title, tags: info.tags, salary: info.salary });
    return result.kind === "years" && !jobTypeMatches(result, jobTypeFilter) ? result : null;
  }

  // 粗筛：返回不收集的原因（reason 为空表示通过）和给人看的说明。预览和实际投递共用这一份判断。
  // rules 里的字段名和 state 一致：blockedCompanies、coarseBlockedTags、coarseRequiredTags、
  // includeTags、locationTags、salaryFilter、jobTypeFilter。
  function explainCoarse(info, contacted, rules) {
    if (info.jobId && contacted?.has(info.jobId)) return { reason: "contacted", label: "已沟通过" };
    if (info.headhunter) return { reason: "headhunter", label: "猎头岗位" };
    const title = info.title.toLowerCase();
    const company = info.company.toLowerCase();
    const address = info.address.toLowerCase();
    let kw = rules.blockedCompanies.find((k) => matchKeyword(company, k));
    if (kw) return { reason: "company", label: `排除公司"${kw}"` };
    kw = rules.coarseBlockedTags.find((k) => matchKeyword(title, k));
    if (kw) return { reason: "blocked", label: `职位名排除"${kw}"` };
    kw = rules.coarseRequiredTags.find((k) => !matchKeyword(title, k));
    if (kw) return { reason: "required", label: `缺少必须词"${kw}"` };
    if (rules.includeTags.length && !rules.includeTags.some((k) => matchKeyword(title, k))) {
      return { reason: "optional", label: "未命中任一包含词" };
    }
    if (rules.locationTags.length && !rules.locationTags.some((k) => matchKeyword(address, k))) {
      return { reason: "location", label: "工作地不符" };
    }
    if (!salaryInFilter(info.salary, rules.salaryFilter)) {
      return { reason: "salary", label: isNegotiableSalary(info.salary) ? "薪资面议" : "薪资不符" };
    }
    const jobType = coarseJobTypeRejectBy(info, rules.jobTypeFilter);
    if (jobType) return { reason: "jobtype", label: `经验要求"${JOB_YEARS_LABEL[jobType.bucket]}"` };
    return { reason: "", label: "" };
  }

  function readCardInfo(card) {
    return {
      jobId: ContactedJobs.idOf(card),
      title: card.querySelector(BOSS.cardTitle)?.textContent?.trim() || "",
      company: card.querySelector(BOSS.cardCompany)?.textContent?.trim() || "",
      address: (BOSS.cardAddress.map((selector) => card.querySelector(selector)?.textContent).find(Boolean) || "").trim(),
      salary: decodeSalary(card.querySelector(BOSS.cardSalary)?.textContent?.trim() || ""),
      logo: card.querySelector(BOSS.cardLogo)?.src || "",
      headhunter: (card.querySelector(BOSS.cardBadgeIcon)?.alt || "").includes("猎头"),
      tags: Array.from(card.querySelectorAll(BOSS.cardTags), (li) => li.textContent.trim()).filter(Boolean),
    };
  }

  // 下面这些按当前筛选设置（state）判断，具体规则在 rules/ 里，方便单独测试。
  const salaryMatches = (salaryText) => salaryInFilter(salaryText, state.salaryFilter);
  const coarseExplain = (info, contacted) => explainCoarse(info, contacted, state);
  const coarseRejectReason = (info, contacted) => coarseExplain(info, contacted).reason;
  const jobTypeFilterActive = () => isJobTypeFilterActive(state.jobTypeFilter);
  const jobTypeAccepted = (result) => jobTypeMatches(result, state.jobTypeFilter);
  const coarseJobTypeReject = (info) => coarseJobTypeRejectBy(info, state.jobTypeFilter);

  const hasFilterRules = () => state.includeTags.length || state.coarseBlockedTags.length || state.coarseRequiredTags.length
    || state.detailOptionalTags.length || state.detailRequiredTags.length || state.detailBlockedTags.length
    || state.locationTags.length || state.blockedCompanies.length || state.recruiterIncludeTags.length || jobTypeFilterActive();

  // 筛选设置里的实时预览：用当前页已加载的岗位卡片试跑粗筛，不点开岗位、不消耗投递次数。
  const CoarsePreview = {
    root: null,
    summaryEl: null,
    warnEl: null,
    detailEl: null,
    toggleBtn: null,
    isOpen: false,
    timer: 0,
    cardCount: -1,

    create() {
      const root = document.createElement("div");
      root.className = "zdl-preview";
      const head = document.createElement("div");
      head.className = "zdl-preview-head";
      this.summaryEl = document.createElement("span");
      this.summaryEl.className = "zdl-preview-summary";
      this.summaryEl.setAttribute("aria-live", "polite");
      this.toggleBtn = document.createElement("button");
      this.toggleBtn.type = "button";
      this.toggleBtn.className = "zdl-preview-toggle";
      this.toggleBtn.setAttribute("aria-expanded", "false");
      this.toggleBtn.addEventListener("click", () => {
        this.isOpen = !this.isOpen;
        this.render();
      });
      head.append(this.summaryEl, this.toggleBtn);
      this.warnEl = document.createElement("div");
      this.warnEl.className = "zdl-preview-warn";
      this.detailEl = document.createElement("div");
      this.detailEl.className = "zdl-preview-detail";
      root.append(head, this.warnEl, this.detailEl);
      this.root = root;
      return root;
    },

    schedule() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.render(), 60);
    },

    // 当前页卡片数变化（用户滚动加载、换搜索词）时刷新
    poll() {
      if (!this.root || elements.settingsPanel?.hidden) return;
      const count = document.querySelectorAll(BOSS.jobCard).length;
      if (count !== this.cardCount) this.render();
    },

    compute() {
      const contacted = state.account.id ? ContactedJobs.setFor(state.account.id) : new Set();
      const rows = Array.from(document.querySelectorAll(BOSS.jobCard)).map((card) => {
        const info = readCardInfo(card);
        return { card, info, ...coarseExplain(info, contacted) };
      });
      const title = (row) => row.info.title.toLowerCase();
      // “想要的岗位”：职位名满足你写的必须词和包含词。排除词挡掉这些岗位时视为冲突。
      const hasPositive = state.includeTags.length > 0 || state.coarseRequiredTags.length > 0;
      const wanted = (row) => hasPositive
        && state.coarseRequiredTags.every((k) => matchKeyword(title(row), k))
        && (!state.includeTags.length || state.includeTags.some((k) => matchKeyword(title(row), k)));
      const fields = { title, company: (row) => row.info.company.toLowerCase(), address: (row) => row.info.address.toLowerCase() };
      const tagStats = (tags, field, checkConflict = false) => tags.map((kw) => {
        const hits = rows.filter((row) => matchKeyword(fields[field](row), kw));
        const conflicts = checkConflict ? hits.filter(wanted) : [];
        return { kw, hits: hits.length, conflicts };
      });
      return {
        rows,
        lists: [
          { el: elements.coarseRequiredTagList, stats: tagStats(state.coarseRequiredTags, "title"), what: "职位名" },
          { el: elements.includeTagList, stats: tagStats(state.includeTags, "title"), what: "职位名" },
          { el: elements.coarseBlockedTagList, stats: tagStats(state.coarseBlockedTags, "title", true), what: "职位名" },
          { el: elements.locationTagList, stats: tagStats(state.locationTags, "address"), what: "工作地" },
          { el: elements.blockedCompanyTagList, stats: tagStats(state.blockedCompanies, "company"), what: "公司名" },
        ],
      };
    },

    render() {
      if (!this.root) return;
      clearTimeout(this.timer);
      const { rows, lists } = this.compute();
      this.cardCount = rows.length;
      this._renderTagBadges(rows.length ? lists : []);
      this.toggleBtn.hidden = !rows.length;
      this.toggleBtn.textContent = this.isOpen ? "收起明细" : "明细";
      this.toggleBtn.setAttribute("aria-expanded", String(this.isOpen));

      if (!rows.length) {
        this.summaryEl.textContent = isJobsPage()
          ? "当前页还没有岗位，在 BOSS 上搜索或往下滚动加载后，这里会预览筛选结果"
          : "到「职位」页后，这里会用当前页的岗位预览筛选结果";
        this.warnEl.replaceChildren();
        this.detailEl.replaceChildren();
        return;
      }

      const collected = rows.filter((row) => !row.reason);
      const contactedCount = rows.filter((row) => row.reason === "contacted").length;
      this.summaryEl.innerHTML = "";
      this.summaryEl.append(
        `当前页 ${rows.length} 个岗位，会收集 `,
        Object.assign(document.createElement("strong"), { textContent: String(collected.length) }),
        ` 个${contactedCount ? `（另有 ${contactedCount} 个已沟通过）` : ""}`,
      );

      // 岗位类型分布（只看卡片和职位名，详情里的信息要打开岗位才知道）
      const typeCounts = {};
      rows.forEach((row) => {
        const result = classifyJob({ title: row.info.title, tags: row.info.tags, salary: row.info.salary });
        const key = result.kind === "years" ? "社招" : result.kind === "soft" ? JOB_SIGNAL_LABEL[result.types[0]] : "看详情才知道";
        typeCounts[key] = (typeCounts[key] || 0) + 1;
      });
      const order = [...Object.values(JOB_SIGNAL_LABEL), "看详情才知道"];
      const typeText = "岗位类型（按卡片）：" + order.filter((k) => typeCounts[k]).map((k) => `${k} ${typeCounts[k]}`).join(" · ");

      const conflicts = lists[2].stats.filter((stat) => stat.conflicts.length);
      const conflictLines = conflicts.map((stat) =>
        `排除词“${stat.kw}”挡掉了 ${stat.conflicts.length} 个命中包含词的岗位，例如「${stat.conflicts[0].info.title}」`);
      // 收起时只给一行提示，具体内容放进明细，避免预览区占太多位置
      this.warnEl.replaceChildren();
      if (conflicts.length && !this.isOpen) {
        const warn = document.createElement("button");
        warn.type = "button";
        warn.className = "zdl-preview-warn-btn";
        warn.textContent = `${conflicts.length} 个排除词挡掉了你想要的岗位，点击查看`;
        warn.title = conflictLines.join("\n");
        warn.addEventListener("click", () => { this.isOpen = true; this.render(); });
        this.warnEl.appendChild(warn);
      }

      this.detailEl.hidden = !this.isOpen;
      if (this.isOpen) this._renderDetail(rows, typeText, conflicts);
    },

    _renderTagBadges(lists) {
      [elements.coarseRequiredTagList, elements.includeTagList, elements.coarseBlockedTagList,
        elements.locationTagList, elements.blockedCompanyTagList].forEach((el) => {
        el?.querySelectorAll(".zdl-tag-hit").forEach((badge) => badge.remove());
        el?.querySelectorAll(".zdl-tag").forEach((tag) => { tag.classList.remove("conflict"); tag.title = tag.dataset.tip || ""; });
      });
      lists.forEach(({ el, stats, what }) => {
        if (!el) return;
        el.querySelectorAll(".zdl-tag").forEach((tag) => {
          const stat = stats[Number(tag.dataset.index)];
          if (!stat) return;
          const badge = document.createElement("span");
          badge.className = "zdl-tag-hit" + (stat.hits ? "" : " zero");
          badge.textContent = String(stat.hits);
          tag.insertBefore(badge, tag.querySelector(".zdl-tag-remove"));
          let tip = `当前页${what}命中 ${stat.hits} 个岗位`;
          if (stat.conflicts.length) {
            tag.classList.add("conflict");
            tip += `；其中 ${stat.conflicts.length} 个也命中包含词，例如：${stat.conflicts.slice(0, 3).map((row) => row.info.title).join("、")}`;
          }
          tag.title = tag.dataset.tip ? `${tag.dataset.tip}\n${tip}` : tip;
        });
      });
    },

    // 在页面上定位某个岗位卡片并短暂高亮
    locate(card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.remove("zdl-preview-flash");
      void card.offsetWidth;
      card.classList.add("zdl-preview-flash");
      clearTimeout(card.__zdlFlashTimer);
      card.__zdlFlashTimer = setTimeout(() => card.classList.remove("zdl-preview-flash"), 1800);
    },

    _renderDetail(rows, typeText, conflicts) {
      const counts = {};
      rows.forEach((row) => { if (row.reason) counts[row.label] = (counts[row.label] || 0) + 1; });
      const reasons = document.createElement("div");
      reasons.className = "zdl-preview-reasons";
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      reasons.textContent = top.length ? `排除原因：${top.map(([label, n]) => `${label} ${n}`).join(" · ")}` : "当前页岗位全部会被收集";
      const list = document.createElement("div");
      list.className = "zdl-preview-list";
      // 会收集的排在前面，其余按原因分组
      const sorted = [...rows].sort((a, b) => Number(!!a.reason) - Number(!!b.reason) || a.label.localeCompare(b.label));
      sorted.forEach((row) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "zdl-preview-row";
        item.title = "在页面上定位这个岗位";
        const name = document.createElement("span");
        name.className = "zdl-preview-title";
        name.textContent = row.info.title || "（无职位名）";
        const company = document.createElement("span");
        company.className = "zdl-preview-company";
        company.textContent = row.info.company;
        const status = document.createElement("span");
        status.className = "zdl-preview-status" + (row.reason ? "" : " ok");
        status.textContent = row.reason ? row.label : "会收集";
        item.append(name, company, status);
        item.addEventListener("click", () => this.locate(row.card));
        list.appendChild(item);
      });
      const types = document.createElement("div");
      types.className = "zdl-preview-types";
      types.textContent = typeText;
      const warns = document.createElement("div");
      warns.className = "zdl-preview-warn-list";
      // 每条冲突列出被挡掉的岗位，点岗位名即可在页面上定位
      conflicts.forEach((stat) => {
        const line = document.createElement("div");
        line.className = "zdl-preview-warn-item";
        const text = document.createElement("span");
        text.textContent = `排除词“${stat.kw}”挡掉了 ${stat.conflicts.length} 个命中包含词的岗位：`;
        line.appendChild(text);
        stat.conflicts.slice(0, 5).forEach((row) => {
          const job = document.createElement("button");
          job.type = "button";
          job.className = "zdl-preview-job-link";
          job.textContent = row.info.title || "（无职位名）";
          job.title = `${row.info.company} · 点击在页面上定位`;
          job.addEventListener("click", () => this.locate(row.card));
          line.appendChild(job);
        });
        if (stat.conflicts.length > 5) line.append(` 等 ${stat.conflicts.length} 个`);
        warns.appendChild(line);
      });
      this.detailEl.replaceChildren(...(conflicts.length ? [warns] : []), types, reasons, list);
    },
  };

  const AccountsMethods = {
    _createAccountsPanel() {
      const panel = document.createElement("div");
      panel.id = "zdl-accounts-panel";
      panel.className = "zdl-settings-panel zdl-accounts-panel";
      panel.hidden = true;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-labelledby", "zdl-accounts-title");
      const header = document.createElement("div");
      header.className = "zdl-settings-header";
      const title = document.createElement("h4");
      title.id = "zdl-accounts-title";
      title.textContent = "本机账号投递";
      const close = this._createIconButton(UI_ICONS.close, () => this._hideAccountsPanel(true), "关闭账号详情");
      close.setAttribute("aria-label", "关闭账号详情");
      header.append(title, close);
      elements.accountsContent = document.createElement("div");
      elements.accountsContent.className = "zdl-accounts-content";
      elements.accountsContent.tabIndex = 0;
      elements.accountsContent.setAttribute("aria-label", "账号投递列表");
      panel.append(header, elements.accountsContent);
      return panel;
    },


    _showAccountsPanel() {
      this._hideSettingsPanel();
      document.getElementById("zdl-history-panel")?.remove();
      elements.accountsPanel.hidden = false;
      elements.accountsBtn.setAttribute("aria-expanded", "true");
      this._renderAccountsPanel();
      this._positionSettingsPanel(elements.accountsPanel);
    },


    _hideAccountsPanel(restoreFocus = false) {
      if (!elements.accountsPanel) return;
      elements.accountsPanel.hidden = true;
      elements.accountsBtn?.setAttribute("aria-expanded", "false");
      if (restoreFocus) elements.accountsBtn?.focus({ preventScroll: true });
    },


    _renderAccountsPanel() {
      const content = elements.accountsContent;
      try {
        const stats = Delivery.readStats();
        const snapshot = JSON.stringify([state.account.id, new Date().toLocaleDateString(), stats]);
        if (snapshot === this._accountsSnapshot) return;
        const ids = new Set(Object.keys(stats.accounts));
        if (state.account.id) ids.add(state.account.id);
        const rows = [...ids].map((id) => ({ id, ...Delivery.forToday(stats.accounts[id]) }))
          .sort((a, b) => Number(b.id === state.account.id) - Number(a.id === state.account.id)
            || b.dailyCount - a.dailyCount || a.id.localeCompare(b.id));
        const machine = Delivery.forToday(stats.machine);
        const summary = document.createElement("p");
        summary.className = "zdl-accounts-summary";
        summary.textContent = `本机今日 ${machine.dailyCount} 次 · 累计 ${machine.totalCount} 次`;
        const table = document.createElement("table");
        table.className = "zdl-accounts-table";
        table.setAttribute("aria-label", "本机账号投递详情");
        table.innerHTML = "<thead><tr><th scope=col>账号</th><th scope=col>今日</th><th scope=col>累计</th></tr></thead>";
        const body = document.createElement("tbody");
        const appendRow = (label, dailyCount, totalCount, current = false) => {
          const row = document.createElement("tr");
          if (current) row.className = "zdl-current-account";
          const name = document.createElement("th");
          name.scope = "row";
          name.textContent = label;
          if (current) {
            const badge = document.createElement("span");
            badge.className = "zdl-current-badge";
            badge.textContent = "当前";
            name.appendChild(badge);
          }
          const daily = document.createElement("td");
          daily.textContent = String(dailyCount);
          const total = document.createElement("td");
          total.textContent = String(totalCount);
          row.append(name, daily, total);
          body.appendChild(row);
        };
        rows.forEach((row) => appendRow(Delivery.maskUid(row.id), row.dailyCount, row.totalCount, row.id === state.account.id));
        const oldDaily = Math.max(0, machine.dailyCount - rows.reduce((sum, row) => sum + row.dailyCount, 0));
        const oldTotal = Math.max(0, machine.totalCount - rows.reduce((sum, row) => sum + row.totalCount, 0));
        if (oldDaily || oldTotal) appendRow("旧版未归属", oldDaily, oldTotal);
        table.appendChild(body);
        const note = document.createElement("p");
        note.className = "zdl-accounts-note";
        note.textContent = rows.length ? "仅统计本浏览器中脚本记录的次数。" : "暂无账号记录。";
        content.replaceChildren(summary, ...(body.children.length ? [table] : []), note);
        this._accountsSnapshot = snapshot;
      } catch (error) {
        this._accountsSnapshot = "";
        const message = document.createElement("p");
        message.className = "zdl-accounts-error";
        message.setAttribute("role", "alert");
        message.textContent = "无法读取本机账号记录，请检查存储后刷新。";
        content.replaceChildren(message);
      }
    },
  };

  // ---------- 求职向导 ----------
  // 方向：include 写进“职位名包含任一”；exclusive 的方向没被选中时，signature 写进“职位名排除”。
  // allows：选中该方向时，不排除这些方向（全栈本身就含前后端，AI 应用常写成“AI后端”）。
  const WIZARD_DIRECTIONS = [
    { key: "backend", label: "后端", exclusive: true, include: "后[端台]|服务端|服务器开发|server|[研开]发工程师|软件开发|软件工程师", signature: "后端|服务端" },
    { key: "fullstack", label: "全栈", exclusive: false, include: "全栈|full[- ]?stack", allows: ["backend", "frontend"] },
    { key: "ai", label: "AI应用/Agent", exclusive: false, include: "ai*|agent|智能体|大模型|llm|aigc|rag", allows: ["backend", "fullstack"] },
    { key: "frontend", label: "前端", exclusive: true, include: "前端|h5|vue|react|小程序", signature: "前端|h5" },
    { key: "testing", label: "测试", exclusive: true, include: "测试|测开|qa|质量保障", signature: "测试|测开|qa" },
    { key: "data", label: "数据/大数据", exclusive: true, include: "数据开发|大数据|数仓|etl|数据工程|spark|flink|bi", signature: "大数据|数仓|数据开发|etl" },
    { key: "algorithm", label: "算法", exclusive: true,
      include: "算法|机器学习|深度学习|强化学习|多模态|大模型训练|数据挖掘|计算机视觉|自然语言|语音识别|cv|nlp|ocr|slam|推荐|搜索",
      signature: "算法|机器学习|深度学习|强化学习|cv|nlp|推理优化" },
    { key: "client", label: "客户端/移动端", exclusive: true, include: "客户端|安卓|android|ios|移动端|鸿蒙|harmonyos|flutter|app开发", signature: "客户端|安卓|android|ios|移动端|鸿蒙|flutter" },
    { key: "embedded", label: "嵌入式/硬件", exclusive: true, include: "嵌入式|硬件|单片机|驱动|fpga|stm32|plc", signature: "嵌入式|硬件|单片机|fpga|驱动开发" },
    { key: "ops", label: "运维/DevOps", exclusive: true, include: "运维|devops|sre|k8s|云原生", signature: "运维|devops|sre" },
    { key: "game", label: "游戏", exclusive: true, include: "游戏|unity|ue[45]|cocos", signature: "游戏|unity|ue[45]" },
    { key: "security", label: "安全", exclusive: true, include: "安全|渗透|逆向", signature: "安全|渗透|逆向" },
  ];
  // 技术栈：title 写进“职位名包含任一”（“Java开发”这类职位名），jd 写进“详情包含任一”
  const WIZARD_STACKS = [
    { key: "java", label: "Java", title: "java", jd: "java|spring*|mybatis|微服务" },
    { key: "python", label: "Python", title: "python", jd: "python|django|flask|fastapi" },
    { key: "go", label: "Go", title: "golang|go开发|go语言", jd: "golang|go语言|go开发|gin" },
    { key: "cpp", label: "C/C++", title: "c\\+\\+|cpp", jd: "c\\+\\+|cpp|qt" },
    { key: "js", label: "JS/TS", title: "javascript|typescript|node*", jd: "javascript|typescript|vue|react|node*" },
    { key: "php", label: "PHP", title: "php", jd: "php|laravel|thinkphp" },
    { key: "dl", label: "深度学习框架", title: "pytorch|tensorflow", jd: "pytorch|tensorflow|paddle*|cuda|transformers|深度学习框架" },
  ];
  const WIZARD_NON_TECH = "销售|客服|主播|电销|地推|售前|售后|技术支持|实施|运营|美术|原画|商务|产品经理|产品助理";
  const WIZARD_HR = "hr*|招聘|人事";
  const WIZARD_RECENT_STATUS = ["在线", "刚刚活跃", "今日活跃", "3日内活跃"];
  const WIZARD_YEARS_UP_TO = { 1: ["y0_1", "none"], 3: ["y0_1", "y1_3", "none"], 5: ["y0_1", "y1_3", "y3_5", "none"], all: JOB_YEARS.map(([k]) => k) };
  const defaultWizardAnswers = () => ({
    identities: [], includeOpen: true, maxYears: "3", directions: [], stacks: [],
    minSalary: "", negotiable: true, onlyHr: false, recentActive: true, excludeNonTech: true,
  });

  // 由向导答案生成配置里向导负责的那几项；其他项（排除公司、工作地、详情排除、今日目标）保持不变
  function generateWizardConfig(answers) {
    const a = { ...defaultWizardAnswers(), ...answers };
    const selected = new Set(a.directions);
    const allowed = new Set();
    WIZARD_DIRECTIONS.filter((d) => selected.has(d.key)).forEach((d) => (d.allows || []).forEach((k) => allowed.add(k)));
    const includeTags = [
      ...WIZARD_DIRECTIONS.filter((d) => selected.has(d.key)).map((d) => d.include),
      ...WIZARD_STACKS.filter((s) => a.stacks.includes(s.key)).map((s) => s.title),
    ];
    const coarseBlockedTags = WIZARD_DIRECTIONS
      .filter((d) => d.exclusive && !selected.has(d.key) && !allowed.has(d.key))
      .map((d) => d.signature);
    if (a.excludeNonTech) coarseBlockedTags.push(WIZARD_NON_TECH);
    const types = [...a.identities];
    if (a.includeOpen) types.push("open");
    const years = WIZARD_YEARS_UP_TO[a.maxYears] || WIZARD_YEARS_UP_TO.all;
    const min = String(parseInt(a.minSalary, 10) || "");
    return {
      jobTypeFilter: normalizeJobTypeFilter({ types, years: a.identities.includes("social") ? years : JOB_YEARS.map(([k]) => k) }),
      includeTags,
      coarseRequiredTags: [],
      coarseBlockedTags,
      detailRequiredTags: [],
      detailOptionalTags: WIZARD_STACKS.filter((s) => a.stacks.includes(s.key)).map((s) => s.jd),
      salaryFilter: { type: min ? "atLeast" : "none", min, max: "", negotiable: a.negotiable !== false },
      recruiterIncludeTags: a.onlyHr ? [WIZARD_HR] : [],
      recruiterActivityStatus: a.recentActive ? [...WIZARD_RECENT_STATUS] : [...RECRUITER_STATUS_OPTIONS],
    };
  }

  // 向导生成的关键词是一长串写法（如“后[端台]|服务端|…”），界面上用名字代替。
  // 只认和向导生成的原文完全一致的关键词，用户改过的照原样显示。
  const WIZARD_KEYWORD_NAMES = new Map();
  const nameKeyword = (keyword, name) => {
    if (keyword && keyword.includes("|") && !WIZARD_KEYWORD_NAMES.has(keyword)) WIZARD_KEYWORD_NAMES.set(keyword, name);
  };
  WIZARD_DIRECTIONS.forEach((d) => {
    nameKeyword(d.include, `${d.label}方向`);
    nameKeyword(d.signature, `${d.label}方向`);
  });
  WIZARD_STACKS.forEach((s) => {
    nameKeyword(s.title, `${s.label}职位`);
    nameKeyword(s.jd, `${s.label}相关技术`);
  });
  nameKeyword(WIZARD_NON_TECH, "非技术岗（销售、客服、运营等）");
  nameKeyword(WIZARD_HR, "HR / 招聘人员");

  const wizardKeywordName = (keyword) => WIZARD_KEYWORD_NAMES.get(keyword) || "";

  function saveTags() {
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

  const CONFIG_TAG_STORAGE_KEYS = {
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

  const CONFIG_UNDO_KEY = "zdlConfigUndoV1";
  const CONFIG_STORAGE_KEYS = [...Object.values(CONFIG_TAG_STORAGE_KEYS), "zdlTargetCount", "salaryFilter", "recruiterActivityStatus", "zdlJobTypeFilter"];
  const CONFIG_FIELD_LABELS = {
    targetCount: "今日目标", salaryFilter: "薪资范围", recruiterActivityStatus: "招聘者活跃状态", jobTypeFilter: "岗位类型",
    includeTags: "职位名 · 包含任一", coarseRequiredTags: "职位名 · 必须包含", coarseBlockedTags: "职位名 · 排除",
    locationTags: "工作地", blockedCompanies: "排除公司",
    detailBlockedTags: "详情 · 排除", detailRequiredTags: "详情 · 必须包含", detailOptionalTags: "详情 · 包含任一",
    recruiterIncludeTags: "只投招聘者",
  };

  let configExternalChanged = false;
  // 其他标签页改了配置时由 storage 事件调用；之后本页不再写配置，避免覆盖。
  function markConfigExternalChanged() {
    configExternalChanged = true;
  }
  let configUndoInvalidated = false;

  function getCurrentConfig() {
    const config = {
      targetCount: state.targetCount,
      salaryFilter: { type: state.salaryFilter.type, min: state.salaryFilter.min, max: state.salaryFilter.max, negotiable: state.salaryFilter.negotiable !== false },
      recruiterActivityStatus: [...state.settings.recruiterActivityStatus],
      jobTypeFilter: { types: [...state.jobTypeFilter.types], years: [...state.jobTypeFilter.years] },
    };
    Object.keys(CONFIG_TAG_STORAGE_KEYS).forEach((key) => { config[key] = [...state[key]]; });
    return config;
  }

  function exportConfig() {
    return JSON.stringify({ type: "zdl-boss-config", version: 1, config: getCurrentConfig() }, null, 2);
  }

  function parseConfig(jsonText) {
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
    if (!isObject(salary) || !["none", "range", "atLeast", "atMost"].includes(salary.type)
      || !validSalaryValue(salary.min) || !validSalaryValue(salary.max)
      || (salary.negotiable !== undefined && typeof salary.negotiable !== "boolean")) {
      throw new Error("薪资配置无效，请检查薪资类型和上下限。");
    }
    const jobType = config.jobTypeFilter;
    const validKeys = (list, all, legacy = {}) => Array.isArray(list) && list.every((k) => legacy[k] || all.some(([key]) => key === k));
    if (jobType !== undefined && (!isObject(jobType) || !validKeys(jobType.types, JOB_TYPES, LEGACY_JOB_TYPES) || !validKeys(jobType.years, JOB_YEARS))) {
      throw new Error("岗位类型配置无效。");
    }
    const activityOptions = RECRUITER_STATUS_OPTIONS;
    if (!Array.isArray(config.recruiterActivityStatus)
      || !config.recruiterActivityStatus.every((value) => activityOptions.includes(value))) {
      throw new Error("招聘者活跃状态配置无效。");
    }
    // 薪资类型由上下限推出来（旧配置里“范围 + 最高留空”和“至少”是同一个意思）
    const salaryMin = salary.type === "none" || salary.type === "atMost" ? "" : salary.min.trim();
    const salaryMax = salary.type === "none" || salary.type === "atLeast" ? "" : salary.max.trim();
    const salaryType = salaryMin && salaryMax ? "range" : salaryMin ? "atLeast" : salaryMax ? "atMost" : "none";
    const normalized = {
      targetCount: config.targetCount,
      salaryFilter: { type: salaryType, min: salaryMin, max: salaryMax, negotiable: salary.negotiable !== false },
      recruiterActivityStatus: [...config.recruiterActivityStatus],
      jobTypeFilter: normalizeJobTypeFilter(jobType),
    };
    Object.keys(CONFIG_TAG_STORAGE_KEYS).forEach((key) => { normalized[key] = [...config[key]]; });
    return normalized;
  }

  function formatConfigValue(key, value) {
    if (key === "targetCount") return `${value} 次`;
    if (key === "salaryFilter") {
      const range = value.type === "atLeast" && value.min ? `${value.min}K 以上`
        : value.type === "atMost" && value.max ? `${value.max}K 以下`
        : value.type === "range" && (value.min || value.max) ? `${value.min || "不限"} ~ ${value.max || "不限"}K` : "不限";
      return `${range}，${value.negotiable === false ? "不含" : "含"}面议`;
    }
    if (key === "jobTypeFilter") {
      const types = value.types.length === JOB_TYPES.length ? "全部类型" : value.types.map((k) => JOB_TYPE_LABEL[k]).join("、") || "不投任何类型";
      const years = value.types.includes("social") && value.years.length < JOB_YEARS.length
        ? `；社招 ${value.years.map((k) => JOB_YEARS_LABEL[k]).join("、") || "不投"}` : "";
      return types + years;
    }
    if (!value.length) return ["locationTags", "recruiterActivityStatus"].includes(key) ? "不限" : "清空";
    return value.map((keyword) => wizardKeywordName(keyword) || keyword).join("、");
  }

  function getConfigChanges(config) {
    const current = getCurrentConfig();
    return Object.keys(current).filter((key) => JSON.stringify(current[key]) !== JSON.stringify(config[key]))
      .map((key) => ({ key, label: CONFIG_FIELD_LABELS[key], before: formatConfigValue(key, current[key]), after: formatConfigValue(key, config[key]) }));
  }

  function getConfigStorageValues(config) {
    const values = {};
    Object.entries(CONFIG_TAG_STORAGE_KEYS).forEach(([key, storageKey]) => { values[storageKey] = JSON.stringify(config[key]); });
    values.zdlTargetCount = String(config.targetCount);
    values.salaryFilter = JSON.stringify(config.salaryFilter);
    values.recruiterActivityStatus = JSON.stringify(config.recruiterActivityStatus);
    values.zdlJobTypeFilter = JSON.stringify(config.jobTypeFilter);
    return values;
  }

  function assertConfigIdle() {
    if (state.isRunning || state.activeRun) throw new Error("请先停止海投，等待任务结束后再导入或撤销。");
    if (configExternalChanged) throw new Error("其他页面已修改配置，请刷新后重试。");
  }

  function writeConfig(config, undoValue) {
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
    Object.assign(state.salaryFilter, config.salaryFilter);
    state.settings.recruiterActivityStatus.splice(0);
    config.recruiterActivityStatus.forEach((value) => state.settings.recruiterActivityStatus.push(value));
    state.jobTypeFilter = normalizeJobTypeFilter(config.jobTypeFilter);
  }

  function importConfig(jsonText) {
    assertConfigIdle();
    const config = parseConfig(jsonText);
    const changes = getConfigChanges(config);
    if (!changes.length) return 0;
    const undo = JSON.stringify({ version: 1, before: getCurrentConfig(), after: config });
    writeConfig(config, undo);
    configUndoInvalidated = false;
    return changes.length;
  }

  function getConfigUndo() {
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

  function canUndoConfigImport() {
    return !state.isRunning && !state.activeRun && !!getConfigUndo();
  }

  function undoConfigImport() {
    assertConfigIdle();
    const undo = getConfigUndo();
    if (!undo) throw new Error("配置已修改，或没有可撤销的导入。");
    writeConfig(undo.before, null);
  }

  function invalidateConfigUndo() {
    configUndoInvalidated = true;
    try { localStorage.removeItem(CONFIG_UNDO_KEY); } catch (error) {}
    if (elements.configImportBtn) {
      elements.configFallback.hidden = true;
      UI._setConfigStatus("");
      UI._updateConfigControls();
    }
  }

  const ConfigShareMethods = {
    _createConfigControls() {
      const section = document.createElement("div");
      section.className = "zdl-config-controls";
      const buttons = document.createElement("div");
      buttons.className = "zdl-config-buttons";
      const makeButton = (label, action) => {
        const button = this._createTextButton(label, action);
        button.className = "zdl-config-btn";
        button.type = "button";
        return button;
      };
      const fallback = document.createElement("div");
      elements.configFallback = fallback;
      fallback.hidden = true;
      const text = document.createElement("textarea");
      text.className = "zdl-config-text";
      text.rows = 4;
      text.readOnly = true;
      text.spellcheck = false;
      text.setAttribute("aria-label", "手动复制配置");
      fallback.append(text, makeButton("收起原文", () => { fallback.hidden = true; this._setConfigStatus(""); }));
      elements.configCopyBtn = makeButton("复制配置", async () => {
        if (this._copyingConfig || configExternalChanged) return;
        const json = exportConfig();
        this._copyingConfig = true;
        this._updateConfigControls();
        try {
          await navigator.clipboard.writeText(json);
          fallback.hidden = true;
          this._setConfigStatus("已复制");
        } catch (error) {
          text.value = json;
          fallback.hidden = false;
          text.focus();
          text.select();
          this._setConfigStatus("复制受限，请手动复制选中的文字。");
        } finally {
          this._copyingConfig = false;
          this._updateConfigControls();
        }
      });
      elements.configImportBtn = makeButton("导入配置", () => this._showConfigImport());
      elements.configUndoBtn = makeButton("撤销上次替换", () => {
        try {
          undoConfigImport();
          fallback.hidden = true;
          try {
            this._refreshConfigFilters();
            this._setConfigStatus("已恢复替换前的配置");
          } catch (error) { this._setConfigStatus("配置已恢复，请刷新页面更新显示。", true); }
        } catch (error) { this._setConfigStatus(error.message, true); }
        this._updateConfigControls();
      });
      elements.configUndoBtn.hidden = true;
      elements.configCopyBtn.title = "复制当前筛选配置，可分享给别人导入";
      elements.configImportBtn.title = "粘贴配置文本，替换当前筛选条件（投递记录保留）";
      buttons.append(elements.configUndoBtn, elements.configImportBtn, elements.configCopyBtn);
      elements.configStatus = document.createElement("div");
      elements.configStatus.className = "zdl-config-status";
      elements.configStatus.setAttribute("aria-live", "polite");
      const row = document.createElement("div");
      row.className = "zdl-config-row";
      row.append(elements.configStatus, buttons);
      section.append(fallback, row);
      return section;
    },


    _setConfigStatus(message, error = false) {
      elements.configStatus.textContent = message;
      elements.configStatus.classList.toggle("error", error);
    },


    _updateConfigControls() {
      if (!elements.configImportBtn) return;
      const busy = state.isRunning || !!state.activeRun;
      elements.configCopyBtn.disabled = !!this._copyingConfig || configExternalChanged;
      elements.configImportBtn.disabled = configExternalChanged;
      elements.configUndoBtn.hidden = !getConfigUndo();
      elements.configUndoBtn.disabled = busy || !canUndoConfigImport();
      if (configExternalChanged) this._setConfigStatus("其他页面已修改配置，请刷新后重试。", true);
      if (elements.configDialog?.open) this._renderConfigPreview();
    },


    _createConfigImportDialog() {
      const dialog = document.createElement("dialog");
      dialog.id = "zdl-config-import";
      dialog.className = "zdl-import-dialog";
      dialog.setAttribute("aria-labelledby", "zdl-import-title");
      dialog.setAttribute("aria-describedby", "zdl-import-scope");
      const header = document.createElement("div");
      header.className = "zdl-settings-header";
      const title = document.createElement("h4");
      title.id = "zdl-import-title";
      title.textContent = "导入配置";
      const close = this._createIconButton(UI_ICONS.close, () => this._hideConfigImport(), "关闭导入");
      close.setAttribute("aria-label", "关闭导入");
      header.append(title, close);
      const body = document.createElement("div");
      body.className = "zdl-import-body";
      const scope = document.createElement("p");
      scope.id = "zdl-import-scope";
      scope.className = "zdl-config-scope";
      scope.textContent = "替换筛选条件和今日目标，保留账号及投递记录。";
      elements.configInput = document.createElement("textarea");
      elements.configInput.className = "zdl-config-text";
      elements.configInput.rows = 4;
      elements.configInput.spellcheck = false;
      elements.configInput.placeholder = "粘贴“复制配置”生成的内容";
      elements.configInput.setAttribute("aria-label", "配置文本");
      elements.configFeedback = document.createElement("p");
      elements.configFeedback.className = "zdl-import-feedback";
      elements.configFeedback.setAttribute("aria-live", "polite");
      elements.configPreview = document.createElement("dl");
      elements.configPreview.className = "zdl-config-diff";
      const footer = document.createElement("div");
      footer.className = "zdl-import-footer";
      const cancel = this._createTextButton("取消", () => this._hideConfigImport());
      cancel.className = "zdl-config-btn";
      elements.configApplyBtn = this._createTextButton("替换配置", () => {
        let currentBase;
        try { currentBase = this._getConfigPreviewBase(); }
        catch (error) { this._configPreviewKey = ""; this._renderConfigPreview(); return; }
        if (this._configPreviewBase !== currentBase) {
          this._configPreviewKey = "";
          this._renderConfigPreview();
          elements.configFeedback.textContent = "当前配置已变化，请查看更新后的预览。";
          return;
        }
        try {
          const count = importConfig(elements.configInput.value);
          elements.configFallback.hidden = true;
          this._hideConfigImport();
          elements.configInput.value = "";
          this._configPreviewKey = "";
          try {
            this._refreshConfigFilters();
            this._setConfigStatus(count ? (canUndoConfigImport() ? "已导入，可撤销本次替换" : "已导入") : "配置一致，无需替换");
          } catch (error) {
            this._setConfigStatus("配置已保存，请刷新页面更新显示。", true);
          }
        } catch (error) {
          elements.configFeedback.textContent = error.message;
          elements.configFeedback.classList.add("error");
        }
        this._updateConfigControls();
      });
      elements.configApplyBtn.className = "zdl-config-btn zdl-config-primary";
      elements.configApplyBtn.disabled = true;
      footer.append(cancel, elements.configApplyBtn);
      body.append(scope, elements.configInput, elements.configFeedback, elements.configPreview);
      dialog.append(header, body, footer);
      elements.configInput.addEventListener("input", () => this._renderConfigPreview());
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); this._hideConfigImport(); });
      dialog.addEventListener("click", (event) => { event.stopPropagation(); });
      return dialog;
    },


    _getConfigPreviewBase() {
      const storage = CONFIG_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)]);
      return JSON.stringify([getCurrentConfig(), storage]);
    },


    _renderConfigPreview() {
      const text = elements.configInput.value;
      const busy = state.isRunning || !!state.activeRun;
      let base;
      try { base = this._getConfigPreviewBase(); }
      catch (error) {
        elements.configPreview.replaceChildren();
        elements.configApplyBtn.disabled = true;
        elements.configFeedback.textContent = "无法读取本机配置，请检查存储后重试。";
        elements.configFeedback.classList.add("error");
        return;
      }
      const key = JSON.stringify([text, base, busy, configExternalChanged]);
      if (this._configPreviewKey === key) return;
      this._configPreviewKey = key;
      this._configPreviewBase = base;
      elements.configPreview.replaceChildren();
      elements.configApplyBtn.disabled = true;
      elements.configFeedback.classList.remove("error");
      if (configExternalChanged) {
        elements.configFeedback.textContent = "其他页面已修改配置，请刷新后重试。";
        return;
      }
      if (!text.trim()) {
        elements.configFeedback.textContent = "粘贴后自动检查。";
        return;
      }
      try {
        const changes = getConfigChanges(parseConfig(text));
        elements.configFeedback.textContent = busy ? "请先停止投递，等待任务结束。"
          : changes.length ? `已识别，将更新 ${changes.length} 项设置。` : "与当前配置一致，无需替换。";
        elements.configApplyBtn.disabled = busy || !changes.length;
        changes.forEach((change) => {
          const row = document.createElement("div");
          const label = document.createElement("dt");
          label.textContent = change.label;
          const values = document.createElement("dd");
          const before = document.createElement("span");
          before.className = "zdl-config-before";
          before.textContent = change.before;
          const arrow = document.createElement("span");
          arrow.className = "zdl-config-arrow";
          arrow.textContent = "→";
          const after = document.createElement("strong");
          after.textContent = change.after;
          values.append(before, arrow, after);
          row.append(label, values);
          elements.configPreview.appendChild(row);
        });
      } catch (error) {
        elements.configFeedback.textContent = error.message;
        elements.configFeedback.classList.add("error");
      }
    },


    _showConfigImport() {
      this._renderConfigPreview();
      try {
        if (!elements.configDialog.open) elements.configDialog.showModal();
        elements.configInput.focus({ preventScroll: true });
      } catch (error) { this._setConfigStatus("无法打开导入窗口，请刷新后重试。", true); }
    },


    _hideConfigImport(restoreFocus = true) {
      if (!elements.configDialog?.open) return;
      elements.configDialog.close();
      if (restoreFocus && !elements.settingsPanel.hidden) elements.configImportBtn.focus({ preventScroll: true });
    },
  };

  // 通用确认框：和导入配置弹窗同样的样式。返回用户点的那个按钮的 value，关闭或按 Esc 返回 null。
  const ConfirmMethods = {
    _confirm({ title, message, actions }) {
      if (this._confirmDialog?.open) return Promise.resolve(null);
      const dialog = document.createElement("dialog");
      dialog.className = "zdl-import-dialog zdl-confirm-dialog";
      dialog.setAttribute("aria-labelledby", "zdl-confirm-title");
      dialog.setAttribute("aria-describedby", "zdl-confirm-message");
      const header = document.createElement("div");
      header.className = "zdl-settings-header";
      const heading = Object.assign(document.createElement("h4"), { id: "zdl-confirm-title", textContent: title });
      header.appendChild(heading);
      const body = Object.assign(document.createElement("p"), { id: "zdl-confirm-message", className: "zdl-confirm-message", textContent: message });
      const footer = document.createElement("div");
      footer.className = "zdl-import-footer";
      dialog.append(header, body, footer);
      this._confirmDialog = dialog;

      return new Promise((resolve) => {
        let result = null;
        actions.forEach(({ label, value, primary }) => {
          const button = this._createTextButton(label, () => {
            result = value;
            dialog.close();
          });
          button.className = `zdl-config-btn${primary ? " zdl-config-primary" : ""}`;
          footer.appendChild(button);
        });
        dialog.addEventListener("close", () => {
          dialog.remove();
          this._confirmDialog = null;
          resolve(result);
        });
        document.body.appendChild(dialog);
        dialog.showModal();
        footer.querySelector(".zdl-config-primary")?.focus();
      });
    },
  };

  const collapseInstances = [];


  function renderTagList(container, tags, tagType = "", editIndex) {
    container.innerHTML = "";
    tags.forEach((tag, i) => {
      const tagEl = createTagElement(tag, i, tags, container, tagType, editIndex);
      container.appendChild(tagEl);
    });
    CoarsePreview.schedule();
  }


  function createTagElement(text, index, tags, container, tagType = "", editIndex) {
    const el = document.createElement("span");
    el.className = "zdl-tag" + (tagType ? " " + tagType : "");
    if (editIndex === index) el.classList.add("editing");
    el.draggable = true;
    el.dataset.index = index;

    // 多种写法按 | 分段显示、可换行；向导生成的显示名字，完整写法放在悬停提示和编辑框里
    const textSpan = document.createElement("span");
    textSpan.className = "zdl-tag-text";
    const name = wizardKeywordName(text);
    const parts = splitAlternatives(text);
    if (name) {
      const nameEl = Object.assign(document.createElement("span"), { className: "zdl-tag-name", textContent: name });
      const meta = Object.assign(document.createElement("span"), { className: "zdl-tag-meta", textContent: `${parts.length} 种写法` });
      textSpan.append(nameEl, meta);
    } else if (parts.length > 1) {
      parts.forEach((part) => textSpan.appendChild(Object.assign(document.createElement("span"), { className: "zdl-tag-part", textContent: part })));
    } else {
      textSpan.textContent = text;
    }
    if (parts.length > 1) {
      el.dataset.tip = `${name ? `${name}：` : ""}${parts.join(" / ")}`;
      el.title = el.dataset.tip;
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "zdl-tag-remove";
    removeBtn.innerHTML = "&#x2715;";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      tags.splice(index, 1);
      saveTags();
      renderTagList(container, tags, tagType);
    });

    el.append(textSpan, removeBtn);
    return el;
  }


  function toggleStatusOption(value, chip) {
    const idx = state.settings.recruiterActivityStatus.indexOf(value);
    if (idx >= 0) state.settings.recruiterActivityStatus.splice(idx, 1);
    else state.settings.recruiterActivityStatus.push(value);
    chip.classList.toggle("active", idx < 0);
    chip.setAttribute("aria-pressed", String(idx < 0));
    invalidateConfigUndo();
    localStorage.setItem("recruiterActivityStatus", JSON.stringify(state.settings.recruiterActivityStatus));
    UI._refreshFilterCounts();
  }

  const SettingsMethods = {
    _renderConfigTags() {
      renderTagList(elements.includeTagList, state.includeTags);
      renderTagList(elements.locationTagList, state.locationTags);
      renderTagList(elements.detailBlockedTagList, state.detailBlockedTags, "blocked");
      renderTagList(elements.detailRequiredTagList, state.detailRequiredTags, "required");
      renderTagList(elements.detailOptionalTagList, state.detailOptionalTags, "optional");
      renderTagList(elements.recruiterIncludeTagList, state.recruiterIncludeTags, "optional");
      renderTagList(elements.blockedCompanyTagList, state.blockedCompanies, "blocked");
      renderTagList(elements.coarseBlockedTagList, state.coarseBlockedTags, "blocked");
      renderTagList(elements.coarseRequiredTagList, state.coarseRequiredTags, "required");
      this._refreshFilterCounts();
    },


    _createSettingsPanel() {
      const panel = document.createElement("div");
      panel.className = "zdl-settings-panel";
      panel.id = "zdl-settings-panel";
      panel.hidden = true;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-labelledby", "zdl-settings-title");
      const header = document.createElement("div");
      header.className = "zdl-settings-header";
      const title = document.createElement("h4");
      title.id = "zdl-settings-title";
      title.textContent = "筛选设置";
      const close = this._createIconButton(UI_ICONS.close, () => this._hideSettingsPanel(true), "关闭筛选设置");
      close.setAttribute("aria-label", "关闭筛选设置");
      elements.wizardBtn = document.createElement("button");
      elements.wizardBtn.type = "button";
      elements.wizardBtn.className = "zdl-wizard-btn";
      elements.wizardBtn.innerHTML = `${UI_ICONS.wand}<span>求职向导</span>`;
      elements.wizardBtn.title = "第一次使用？选身份、方向和技术栈，快速生成基础规则";
      elements.wizardBtn.addEventListener("click", () => this._openWizard());
      const tools = document.createElement("div");
      tools.className = "zdl-settings-tools";
      tools.append(elements.wizardBtn, close);
      header.append(title, tools);
      elements.settingsScroll = document.createElement("div");
      elements.settingsScroll.className = "zdl-scroll-wrap zdl-settings-scroll";
      // 还没有任何规则时提示新手用向导；有规则后自动隐藏
      elements.emptyRulesHint = document.createElement("div");
      elements.emptyRulesHint.className = "zdl-empty-rules";
      const hintText = document.createElement("span");
      hintText.innerHTML = "<strong>还没有筛选规则</strong>第一次使用可以用求职向导，选几个选项就能生成基础规则";
      const hintBtn = this._createTextButton("打开求职向导", () => this._openWizard());
      hintBtn.className = "zdl-config-btn zdl-config-primary";
      elements.emptyRulesHint.append(hintText, hintBtn);
      elements.settingsScroll.append(elements.emptyRulesHint, this._createFilterContainer());
      panel.append(header, CoarsePreview.create(), elements.settingsScroll, this._createConfigControls());
      return panel;
    },


    _showSettingsPanel(keepHistory = false) {
      this._hideConfigImport(false);
      this._hideAccountsPanel();
      if (!keepHistory) document.getElementById("zdl-history-panel")?.remove();
      elements.settingsPanel.hidden = false;
      CoarsePreview.render();
      this._positionSettingsPanel();
    },


    _hideSettingsPanel(restoreFocus = false) {
      this._hideConfigImport(false);
      if (!elements.settingsPanel) return;
      elements.settingsPanel.hidden = true;
      if (restoreFocus) elements.settingsBtn?.focus({ preventScroll: true });
    },


    _positionSettingsPanel(panel = elements.settingsPanel) {
      const main = elements.panel.getBoundingClientRect();
      const width = panel.getBoundingClientRect().width;
      const gap = 12;
      let left = main.left - width - gap;
      if (left < gap) left = main.right + gap;
      if (left + width > window.innerWidth - gap) left = (window.innerWidth - width) / 2;
      const top = Math.max(gap, Math.min(main.top, window.innerHeight - 120));
      panel.style.left = `${Math.max(gap, left)}px`;
      panel.style.top = `${top}px`;
      panel.style.maxHeight = `${Math.max(80, window.innerHeight - top - gap)}px`;
    },


    _refreshConfigFilters() {
      const previous = elements.settingsPanel.querySelector(".zdl-filter-container");
      collapseInstances.length = 0;
      previous.replaceWith(this._createFilterContainer());
      this._renderConfigTags();
      elements.targetInput.value = state.targetCount;
      Delivery.render();
      document.getElementById("zdl-history-panel")?.remove();
    },


    _createFilterContainer() {
      const container = document.createElement("div");
      container.className = "zdl-filter-container";

      const coarseRequiredResult = this._createTagSection("必须包含", state.coarseRequiredTags, "如：Java", "required", "职位名全部命中才收集");
      const includeResult = this._createTagSection("包含任一", state.includeTags, "如：后端", "optional", "职位名命中一个即可");
      const coarseBlockedResult = this._createTagSection("排除", state.coarseBlockedTags, "如：外包", "blocked", "职位名命中即跳过");
      const locationResult = this._createTagSection("工作地", state.locationTags, "如：海淀", "", "包含任一，留空不限");
      const blockedCompanyResult = this._createTagSection("排除公司", state.blockedCompanies, "如：某某科技", "blocked", "公司名命中即跳过");

      const blockedResult = this._createTagSection("排除", state.detailBlockedTags, "如：社招", "blocked", "详情命中即跳过");
      const requiredResult = this._createTagSection("必须包含", state.detailRequiredTags, "如：Spring", "required", "全部命中才投递");
      const optionalResult = this._createTagSection("包含任一", state.detailOptionalTags, "如：Java", "optional", "命中一个即可");
      const recruiterResult = this._createTagSection("只投这些招聘者", state.recruiterIncludeTags, "如：hr*|招聘|人事", "optional", "招聘者职位命中任一才投，留空不限");

      const recruiterSection = document.createElement("div");
      recruiterSection.className = "zdl-tag-section";
      const statusRow = document.createElement("div");
      statusRow.className = "zdl-tag-row";
      const statusLabel = this._createFilterLabel("活跃状态", "只投勾选的状态");
      const statusSelect = this._createRecruiterStatusSelect();
      statusRow.append(statusLabel, statusSelect);
      recruiterSection.append(statusRow);

      elements.includeInput = includeResult.input;
      elements.includeTagList = includeResult.tagList;
      elements.locationInput = locationResult.input;
      elements.locationTagList = locationResult.tagList;
      elements.detailBlockedInput = blockedResult.input;
      elements.detailBlockedTagList = blockedResult.tagList;
      elements.detailRequiredInput = requiredResult.input;
      elements.detailRequiredTagList = requiredResult.tagList;
      elements.detailOptionalInput = optionalResult.input;
      elements.detailOptionalTagList = optionalResult.tagList;
      elements.recruiterIncludeInput = recruiterResult.input;
      elements.recruiterIncludeTagList = recruiterResult.tagList;
      elements.blockedCompanyInput = blockedCompanyResult.input;
      elements.blockedCompanyTagList = blockedCompanyResult.tagList;
      elements.coarseBlockedInput = coarseBlockedResult.input;
      elements.coarseBlockedTagList = coarseBlockedResult.tagList;
      elements.coarseRequiredInput = coarseRequiredResult.input;
      elements.coarseRequiredTagList = coarseRequiredResult.tagList;

      const salaryActive = () => (state.salaryFilter.type !== "none" && !!(state.salaryFilter.min || state.salaryFilter.max))
        || state.salaryFilter.negotiable === false;
      container.append(
        this._createCollapsibleSection("岗位类型", "实习 / 校招 / 社招", [
          this._createJobTypeSection(),
        ], () => (jobTypeFilterActive() ? 1 : 0)),
        this._createCollapsibleSection("职位列表粗筛", "职位名、地点、公司、薪资", [
          coarseRequiredResult.section,
          includeResult.section,
          coarseBlockedResult.section,
          locationResult.section,
          blockedCompanyResult.section,
          this._createSalarySection(),
        ], () => state.coarseRequiredTags.length + state.includeTags.length + state.coarseBlockedTags.length
          + state.locationTags.length + state.blockedCompanies.length + (salaryActive() ? 1 : 0)),
        this._createCollapsibleSection("职位详情细筛", "打开详情后判断", [
          blockedResult.section,
          requiredResult.section,
          optionalResult.section,
        ], () => state.detailBlockedTags.length + state.detailRequiredTags.length + state.detailOptionalTags.length),
        this._createCollapsibleSection("招聘者筛选", "打开详情后判断", [
          recruiterSection,
          recruiterResult.section,
        ], () => state.recruiterIncludeTags.length
          + (state.settings.recruiterActivityStatus.length < RECRUITER_STATUS_OPTIONS.length ? 1 : 0))
      );

      return container;
    },


    _createJobTypeSection() {
      const section = document.createElement("div");
      const save = () => {
        invalidateConfigUndo();
        localStorage.setItem("zdlJobTypeFilter", JSON.stringify(state.jobTypeFilter));
        yearsSection.hidden = !state.jobTypeFilter.types.includes("social");
        this._refreshFilterCounts();
        CoarsePreview.schedule();
      };
      const chipRow = (options, list) => {
        const row = document.createElement("div");
        row.className = "zdl-status-tags";
        options.forEach(([key, label]) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "zdl-status-chip";
          chip.dataset.value = key;
          const check = document.createElement("span");
          check.className = "zdl-status-check";
          check.setAttribute("aria-hidden", "true");
          chip.append(check, label);
          const render = () => {
            const on = state.jobTypeFilter[list].includes(key);
            chip.classList.toggle("active", on);
            chip.setAttribute("aria-pressed", String(on));
          };
          chip.addEventListener("click", () => {
            const values = state.jobTypeFilter[list];
            const idx = values.indexOf(key);
            if (idx >= 0) values.splice(idx, 1);
            else values.push(key);
            state.jobTypeFilter = normalizeJobTypeFilter(state.jobTypeFilter);
            render();
            save();
          });
          render();
          row.appendChild(chip);
        });
        return row;
      };
      const make = (title, desc, options, list) => {
        const wrap = document.createElement("div");
        wrap.className = "zdl-tag-section";
        const row = document.createElement("div");
        row.className = "zdl-tag-row";
        row.append(this._createFilterLabel(title, desc), chipRow(options, list));
        wrap.appendChild(row);
        return wrap;
      };
      const typesSection = make("岗位类型", "取消勾选的类型不投", JOB_TYPES, "types");
      const rulesLink = document.createElement("a");
      rulesLink.className = "zdl-filter-link";
      rulesLink.href = `${REPO_URL}#岗位类型怎么判断`;
      rulesLink.target = "_blank";
      rulesLink.rel = "noopener noreferrer";
      rulesLink.textContent = "判断规则";
      rulesLink.title = "综合卡片经验标签、职位名和职位描述判断，点击查看完整规则";
      typesSection.querySelector(".zdl-filter-label").appendChild(rulesLink);
      const yearsSection = make("社招年限", "按岗位要求的最低年限", JOB_YEARS, "years");
      yearsSection.hidden = !state.jobTypeFilter.types.includes("social");
      section.append(typesSection, yearsSection);
      return section;
    },


    _createFilterLabel(title, desc = "") {
      const label = document.createElement("label");
      label.className = "zdl-filter-label";
      const titleEl = document.createElement("span");
      titleEl.className = "zdl-filter-title";
      titleEl.textContent = title;
      label.appendChild(titleEl);
      if (desc) {
        const descEl = document.createElement("span");
        descEl.className = "zdl-filter-desc";
        descEl.textContent = desc;
        label.appendChild(descEl);
      }
      return label;
    },


    _refreshFilterCounts() {
      if (elements.emptyRulesHint) elements.emptyRulesHint.hidden = hasFilterRules();
      collapseInstances.forEach((inst) => {
        if (!inst.countEl || !inst.count) return;
        const n = inst.count();
        inst.countEl.textContent = n ? `已设 ${n} 项` : "未设置";
        inst.countEl.classList.toggle("empty", !n);
      });
    },


    _createTagSection(labelText, tagsRef, placeholder, tagType = "", desc = "") {
      const section = document.createElement("div");
      section.className = "zdl-tag-section";

      const tagRow = document.createElement("div");
      tagRow.className = "zdl-tag-row";

      const label = this._createFilterLabel(labelText, desc);

      const tagList = document.createElement("div");
      tagList.className = "zdl-tag-list";

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "zdl-tag-add-trigger";
      toggleBtn.textContent = "+";
      toggleBtn.title = "添加标签";

      const tagInline = document.createElement("div");
      tagInline.className = "zdl-tag-inline";
      tagInline.append(tagList, toggleBtn);

      tagRow.append(label, tagInline);

      const inputRow = document.createElement("div");
      inputRow.className = "zdl-tag-input-row";
      inputRow.style.display = "none";

      const input = document.createElement("input");
      input.className = "zdl-tag-input";
      input.placeholder = placeholder;

      const addBtn = document.createElement("button");
      addBtn.className = "zdl-tag-add-btn";
      addBtn.textContent = "添加";

      let editingIndex = null;

      const showInput = (initialValue = "") => {
        input.value = initialValue;
        inputRow.style.display = "flex";
        toggleBtn.textContent = "\u2212";
        toggleBtn.dataset.visible = "true";
        addBtn.textContent = editingIndex !== null ? "修改" : "添加";
        checkInput();
        input.focus();
      };

      const hideInput = () => {
        inputRow.style.display = "none";
        toggleBtn.textContent = "+";
        toggleBtn.dataset.visible = "false";
        input.value = "";
        editingIndex = null;
        addBtn.textContent = "添加";
      };

      const doSave = () => {
        const val = input.value.trim();
        if (!val) { hideInput(); return; }
        if (editingIndex !== null) {
          if (tagsRef[editingIndex] !== val && tagsRef.includes(val)) { input.value = ""; return; }
          tagsRef[editingIndex] = val;
        } else {
          if (tagsRef.includes(val)) { input.value = ""; return; }
          tagsRef.push(val);
        }
        saveTags();
        renderTagList(tagList, tagsRef, tagType, editingIndex);
        hideInput();
      };

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); doSave(); }
        if (e.key === "Escape") { hideInput(); }
      });

      addBtn.addEventListener("click", doSave);

      toggleBtn.addEventListener("click", () => {
        toggleBtn.dataset.visible === "true" ? hideInput() : showInput();
      });

      // 标签点击：进入编辑模式（事件委托）
      tagRow.addEventListener("click", (e) => {
        const tagEl = e.target.closest(".zdl-tag");
        if (!tagEl) return;
        if (e.target.closest(".zdl-tag-remove")) return;
        e.stopPropagation(); // 阻止冒泡到 document → 避免 renderTagList 清 DOM 后触发面板收起
        const idx = parseInt(tagEl.dataset.index, 10);
        if (!isNaN(idx)) {
          if (editingIndex === idx) {
            // 再次点击同一标签 → 取消编辑
            hideInput();
            renderTagList(tagList, tagsRef, tagType);
          } else {
            editingIndex = idx;
            showInput(tagsRef[idx]);
            renderTagList(tagList, tagsRef, tagType, idx);
          }
        }
      });

      // 标签拖拽排序（事件委托）
      let dragSrcIdx = null;
      tagRow.addEventListener("dragstart", (e) => {
        const tagEl = e.target.closest(".zdl-tag");
        if (!tagEl) return;
        dragSrcIdx = parseInt(tagEl.dataset.index, 10);
        e.dataTransfer.effectAllowed = "move";
        tagEl.classList.add("dragging");
      });
      tagRow.addEventListener("dragend", () => {
        tagRow.querySelectorAll(".zdl-tag.dragging").forEach((t) => t.classList.remove("dragging"));
        tagRow.querySelectorAll(".zdl-tag.drag-over").forEach((t) => t.classList.remove("drag-over"));
      });
      tagRow.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const tagEl = e.target.closest(".zdl-tag");
        if (tagEl) {
          tagRow.querySelectorAll(".zdl-tag.drag-over").forEach((t) => t.classList.remove("drag-over"));
          tagEl.classList.add("drag-over");
        }
      });
      tagRow.addEventListener("drop", (e) => {
        e.preventDefault();
        const tagEl = e.target.closest(".zdl-tag");
        if (!tagEl || dragSrcIdx === null) return;
        const targetIdx = parseInt(tagEl.dataset.index, 10);
        if (!isNaN(targetIdx) && dragSrcIdx !== targetIdx) {
          const item = tagsRef.splice(dragSrcIdx, 1)[0];
          tagsRef.splice(targetIdx, 0, item);
          saveTags();
          renderTagList(tagList, tagsRef, tagType, editingIndex);
        }
        dragSrcIdx = null;
      });

      const hint = document.createElement("p");
      hint.className = "zdl-tag-hint";
      hint.innerHTML = "英文按整词匹配（java 不含 javascript）；末尾加 <code>*</code> 匹配前缀，如 <code>spring*</code>；"
        + "多种写法用 <code>|</code> 隔开，如 <code>前端|客户端</code>";

      const hintHTML = hint.innerHTML;
      const checkInput = () => {
        const val = input.value.trim();
        let invalid = false;
        if (/[.*+?^${}()|[\]\\]/.test(val)) {
          try { new RegExp(val); } catch (error) { invalid = true; }
        }
        if (invalid === hint.classList.contains("warn")) return;
        hint.classList.toggle("warn", invalid);
        if (invalid) hint.textContent = "这不是有效的正则写法，会按普通文字匹配";
        else hint.innerHTML = hintHTML;
      };
      input.addEventListener("input", checkInput);

      inputRow.append(input, addBtn, hint);
      section.append(tagRow, inputRow);

      return { section, tagList, input };
    },


    _createSalarySection() {
      const section = document.createElement("div");
      section.className = "zdl-tag-section";

      const row = document.createElement("div");
      row.className = "zdl-tag-row";

      const label = this._createFilterLabel("薪资范围", "月薪，留空表示不限；日薪按 24 天折算");
      const sf = state.salaryFilter;
      const makeInput = (value, placeholder, aria) => {
        const input = document.createElement("input");
        input.className = "zdl-salary-input";
        input.type = "number";
        input.min = "0";
        input.step = "1";
        input.inputMode = "numeric";
        input.placeholder = placeholder;
        input.value = value;
        input.setAttribute("aria-label", aria);
        return input;
      };
      // 兼容旧配置：按类型决定显示哪一边的数值
      const minInput = makeInput(sf.type === "range" || sf.type === "atLeast" ? sf.min : "", "不限", "最低月薪（K）");
      const maxInput = makeInput(sf.type === "range" || sf.type === "atMost" ? sf.max : "", "不限", "最高月薪（K）");

      const field = (input) => {
        const wrap = document.createElement("label");
        wrap.className = "zdl-salary-field";
        const unit = document.createElement("span");
        unit.className = "zdl-salary-unit";
        unit.textContent = "K";
        wrap.append(input, unit);
        return wrap;
      };
      const sep = document.createElement("span");
      sep.className = "zdl-salary-sep";
      sep.textContent = "至";
      const summary = document.createElement("span");
      summary.className = "zdl-salary-summary";

      const clean = (input) => {
        const n = parseInt(input.value, 10);
        input.value = Number.isFinite(n) && n > 0 ? String(n) : "";
        return input.value;
      };
      // 面议岗位是否收集；默认勾选，和以前“面议不拦截”的行为一致
      const negotiable = document.createElement("button");
      negotiable.type = "button";
      negotiable.className = "zdl-status-chip zdl-salary-negotiable";
      negotiable.title = "勾选后，薪资写着“面议”的岗位也会收集";
      const negotiableCheck = document.createElement("span");
      negotiableCheck.className = "zdl-status-check";
      negotiableCheck.setAttribute("aria-hidden", "true");
      negotiable.append(negotiableCheck, "可面议");
      const renderNegotiable = () => {
        const on = state.salaryFilter.negotiable !== false;
        negotiable.classList.toggle("active", on);
        negotiable.setAttribute("aria-pressed", String(on));
      };
      negotiable.addEventListener("click", () => {
        state.salaryFilter.negotiable = state.salaryFilter.negotiable === false;
        renderNegotiable();
        saveSalary();
      });

      const renderSummary = (min, max) => {
        const range = min && max ? `${min}–${max}K` : min ? `${min}K 以上` : max ? `${max}K 以下` : "不限";
        summary.textContent = state.salaryFilter.negotiable === false ? `${range} · 不含面议` : range;
        summary.classList.toggle("empty", !min && !max && state.salaryFilter.negotiable !== false);
      };
      const saveSalary = () => {
        let min = clean(minInput), max = clean(maxInput);
        if (min && max && Number(min) > Number(max)) {
          [min, max] = [max, min];
          minInput.value = min;
          maxInput.value = max;
        }
        state.salaryFilter.type = min && max ? "range" : min ? "atLeast" : max ? "atMost" : "none";
        state.salaryFilter.min = min;
        state.salaryFilter.max = max;
        renderSummary(min, max);
        invalidateConfigUndo();
        localStorage.setItem("salaryFilter", JSON.stringify(state.salaryFilter));
        this._refreshFilterCounts();
        CoarsePreview.schedule();
      };
      minInput.addEventListener("change", saveSalary);
      maxInput.addEventListener("change", saveSalary);
      [minInput, maxInput].forEach((input) => input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur();
      }));

      renderNegotiable();
      renderSummary(minInput.value, maxInput.value);
      row.append(label, field(minInput), sep, field(maxInput), negotiable, summary);
      section.appendChild(row);
      return section;
    },


    _createRecruiterStatusSelect() {
      const container = document.createElement("div");
      container.id = "recruiter-status-select";
      container.className = "zdl-status-tags";

      RECRUITER_STATUS_OPTIONS.forEach((value) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "zdl-status-chip";
        chip.dataset.value = value;
        const active = state.settings.recruiterActivityStatus.includes(value);
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-pressed", String(active));

        const check = document.createElement("span");
        check.className = "zdl-status-check";
        check.setAttribute("aria-hidden", "true");

        const text = document.createElement("span");
        text.textContent = value;

        chip.append(check, text);

        chip.addEventListener("click", () => {
          toggleStatusOption(value, chip);
        });

        container.appendChild(chip);
      });

      return container;
    },


    _createCollapsibleSection(title, desc, children, count) {
      const wrapper = document.createElement("div");
      wrapper.className = "zdl-filter-group";

      const header = document.createElement("div");
      header.className = "zdl-collapse-header";

      const arrow = document.createElement("span");
      arrow.className = "zdl-collapse-arrow";
      arrow.textContent = "▶";

      const label = document.createElement("span");
      label.className = "zdl-collapse-title";
      label.textContent = title;

      const descEl = document.createElement("span");
      descEl.className = "zdl-collapse-desc";
      descEl.textContent = desc;

      const countEl = document.createElement("span");
      countEl.className = "zdl-collapse-count";

      header.append(arrow, label, descEl, countEl);

      const body = document.createElement("div");
      body.className = "zdl-collapse-body collapsed";

      children.forEach((child) => body.appendChild(child));

      const instance = { body, arrow, isOpen: false, countEl, count };
      collapseInstances.push(instance);

      header.addEventListener("click", () => {
        if (instance.isOpen) {
          instance.isOpen = false;
          body.classList.add("collapsed");
          arrow.textContent = "▶";
        } else {
          collapseInstances.forEach((inst) => {
            if (inst.isOpen) {
              inst.isOpen = false;
              inst.body.classList.add("collapsed");
              inst.arrow.textContent = "▶";
              inst.body.querySelectorAll(".zdl-tag-input-row").forEach((row) => { row.style.display = "none"; });
              inst.body.querySelectorAll(".zdl-tag-add-trigger").forEach((btn) => { btn.textContent = "+"; btn.dataset.visible = "false"; });
            }
          });
          instance.isOpen = true;
          body.classList.remove("collapsed");
          arrow.textContent = "▼";
        }
      });

      wrapper.append(header, body);
      return wrapper;
    },
  };

  const HistoryMethods = {
    _showHistoryPanel() {
      this._hideSettingsPanel();
      this._hideAccountsPanel();
      const existing = document.getElementById("zdl-history-panel");
      if (existing) { existing.remove(); return; }

      const history = state.deliveryHistory;
      const dates = Object.keys(history).sort().reverse();
      const today = new Date().toLocaleDateString();
      const logos = state.companyLogos;

      const panel = document.createElement("div");
      panel.id = "zdl-history-panel";
      panel.className = "zdl-history-panel";

      // 头部
      const header = document.createElement("div");
      header.className = "zdl-hist-header";
      const title = document.createElement("h4");
      title.textContent = "投递历史";
      const closeBtn = document.createElement("button");
      closeBtn.id = "zdl-hist-close";
      closeBtn.innerHTML = UI_ICONS.close;
      closeBtn.setAttribute("aria-label", "关闭投递历史");
      closeBtn.addEventListener("click", (e) => { e.stopPropagation(); panel.remove(); });
      header.append(title, closeBtn);

      if (dates.length === 0) {
        const empty = document.createElement("div");
        empty.className = "zdl-hist-empty";
        empty.textContent = "暂无投递记录";
        panel.append(header, empty);
      } else {
        // 日期选择 + 搜索行
        const toolbar = document.createElement("div");
        toolbar.className = "zdl-hist-date-row";

        const select = document.createElement("select");
        select.className = "zdl-hist-select";
        const allOpt = document.createElement("option");
        allOpt.value = "__all__";
        allOpt.textContent = "全部汇总";
        select.appendChild(allOpt);
        dates.forEach((d) => {
          const opt = document.createElement("option");
          opt.value = d;
          opt.textContent = d + (d === today ? " (今天)" : "");
          select.appendChild(opt);
        });
        toolbar.append(document.createTextNode("日期："), select);

        const searchInput = document.createElement("input");
        searchInput.className = "zdl-hist-search";
        searchInput.type = "text";
        searchInput.placeholder = "搜索公司或岗位";
        toolbar.appendChild(searchInput);
        panel.append(header, toolbar);

        const listWrap = document.createElement("div");
        listWrap.className = "zdl-hist-list";
        panel.appendChild(listWrap);

        // 构建单行 DOM 的公共方法
        const buildRow = (e) => {
          const row = document.createElement("div");
          row.className = "zdl-hist-row";
          const companyDiv = document.createElement("div");
          companyDiv.className = "zdl-hist-company";
          const logoUrl = e.logo || logos[e.name] || "";
          if (logoUrl) {
            const img = document.createElement("img");
            img.className = "zdl-hist-logo";
            img.src = logoUrl;
            img.addEventListener("error", () => { img.style.display = "none"; });
            companyDiv.appendChild(img);
          } else {
            const ph = document.createElement("span");
            ph.className = "zdl-hist-no-logo";
            ph.textContent = e.name.slice(0, 1);
            companyDiv.appendChild(ph);
          }
          const nameWrap = document.createElement("div");
          nameWrap.className = "zdl-hist-names";
          const nameSpan = document.createElement("span");
          nameSpan.className = "zdl-hist-name";
          nameSpan.textContent = e.name;
          nameWrap.appendChild(nameSpan);
          if (e.jobs.length) {
            const jobsSpan = document.createElement("span");
            jobsSpan.className = "zdl-hist-jobs";
            jobsSpan.textContent = e.jobs.join("、");
            jobsSpan.title = e.jobs.join("\n");
            nameWrap.appendChild(jobsSpan);
          }
          companyDiv.appendChild(nameWrap);
          const isBlocked = state.blockedCompanies.includes(e.name);
          if (isBlocked) row.classList.add("blocked");
          const countSpan = document.createElement("span");
          countSpan.className = "zdl-hist-count";
          countSpan.textContent = e.count + " 次";
          const actionDiv = document.createElement("div");
          actionDiv.className = "zdl-hist-action";
          const blockBtn = document.createElement("button");
          blockBtn.className = "zdl-hist-block-btn" + (isBlocked ? " blocked" : "");
          blockBtn.textContent = isBlocked ? "已拉黑" : "拉黑";
          blockBtn.title = isBlocked ? "点击取消拉黑" : "以后不再收集这家公司";
          blockBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const blockedIdx = state.blockedCompanies.indexOf(e.name);
            if (blockedIdx !== -1) {
              state.blockedCompanies.splice(blockedIdx, 1);
            } else {
              state.blockedCompanies.push(e.name);
            }
            saveTags();
            if (elements.blockedCompanyTagList) {
              renderTagList(elements.blockedCompanyTagList, state.blockedCompanies, "blocked");
            }
            if (select.value === "__all__") renderAll(); else renderDate(select.value);
          });
          actionDiv.appendChild(blockBtn);
          row.append(companyDiv, countSpan, actionDiv);
          return row;
        };

        const renderEntries = (entries, totalInfo) => {
          listWrap.innerHTML = "";
          const summary = document.createElement("div");
          summary.className = "zdl-hist-date";
          summary.textContent = totalInfo;
          listWrap.appendChild(summary);
          const keyword = searchInput.value.trim().toLowerCase();
          const filtered = keyword
            ? entries.filter((e) => [e.name, ...e.jobs].some((text) => text.toLowerCase().includes(keyword)))
            : entries;
          if (filtered.length === 0) {
            const noResult = document.createElement("div");
            noResult.className = "zdl-hist-empty";
            noResult.textContent = keyword ? `没有匹配 "${keyword}" 的公司或岗位` : "暂无记录";
            listWrap.appendChild(noResult);
          } else {
            filtered.forEach((e) => listWrap.appendChild(buildRow(e)));
          }
        };

        // 单日视图
        const renderDate = (date) => {
          const companies = history[date];
          const entries = Object.entries(companies)
            .map(([name, val]) => ({
              name,
              count: typeof val === "object" ? val.count : val,
              logo: (typeof val === "object" ? val.logo : "") || logos[name] || "",
              jobs: (typeof val === "object" && val.jobs) || [],
            }))
            .sort((a, b) => b.count - a.count);
          const total = entries.reduce((s, e) => s + e.count, 0);
          renderEntries(entries, `共 ${total} 次投递，涉及 ${entries.length} 家公司`);
        };

        // 全部汇总视图
        const renderAll = () => {
          const merged = {};
          dates.forEach((date) => {
            const companies = history[date];
            Object.entries(companies).forEach(([name, val]) => {
              const count = typeof val === "object" ? val.count : val;
              const dayLogo = typeof val === "object" ? val.logo : "";
              if (!merged[name]) merged[name] = { count: 0, logo: dayLogo || logos[name] || "", jobs: [] };
              merged[name].count += count;
              if (typeof val === "object" && val.jobs) merged[name].jobs = [...new Set([...merged[name].jobs, ...val.jobs])];
              if (!merged[name].logo && dayLogo) merged[name].logo = dayLogo;
            });
          });
          const entries = Object.entries(merged)
            .map(([name, obj]) => ({ name, count: obj.count, logo: obj.logo || logos[name] || "", jobs: obj.jobs }))
            .sort((a, b) => b.count - a.count);
          const total = entries.reduce((s, e) => s + e.count, 0);
          renderEntries(entries, `全部汇总：共 ${total} 次投递，涉及 ${entries.length} 家公司`);
        };

        // 切换日期/全部时忽略搜索框残留
        select.addEventListener("change", () => {
          searchInput.value = "";
          select.value === "__all__" ? renderAll() : renderDate(select.value);
        });
        // 搜索框输入时重新渲染当前视图
        searchInput.addEventListener("input", () => {
          select.value === "__all__" ? renderAll() : renderDate(select.value);
        });

        // 默认打开今天的视图
        select.value = dates.includes(today) ? today : dates[0];
        renderDate(select.value);
      }

      // 定位
      const mainPanelEl = document.getElementById("boss-pro-panel");
      if (mainPanelEl && mainPanelEl.style.display !== "none") {
        const rect = mainPanelEl.getBoundingClientRect();
        const width = Math.min(360, window.innerWidth - 24);
        let left = rect.left - width - 12;
        if (left < 12) left = rect.right + 12;
        left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
        const top = Math.max(12, Math.min(rect.top, window.innerHeight - 120));
        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
        panel.style.right = "auto";
        panel.style.maxHeight = `${Math.max(80, Math.min(500, window.innerHeight - top - 12))}px`;
      }

      // 点击空白 / ESC 关闭（仅响应用户真实点击，忽略脚本触发的点击）
      const closeOnOutside = (e) => {
        if (!e.isTrusted) return;
        if (document.getElementById("zdl-tutorial")) return;
        if (elements.settingsPanel?.contains(e.target)) return;
        if (elements.miniIcon && elements.miniIcon.contains(e.target)) return;
        const mainPanel = document.getElementById("boss-pro-panel");
        if (!panel.contains(e.target) && e.target !== elements.historyBtn && !(mainPanel && mainPanel.contains(e.target))) {
          panel.remove();
          document.removeEventListener("click", closeOnOutside, true);
          document.removeEventListener("keydown", onEsc, true);
        }
      };
      const onEsc = (e) => {
        if (document.getElementById("zdl-tutorial")) return;
        if (e.key === "Escape") { panel.remove(); document.removeEventListener("click", closeOnOutside, true); document.removeEventListener("keydown", onEsc, true); }
      };
      setTimeout(() => {
        document.addEventListener("click", closeOnOutside, true);
        document.addEventListener("keydown", onEsc, true);
      }, 0);

      document.body.appendChild(panel);
      this._makeDraggable(panel);
    },
  };

  const PANEL_MOTION = "transform .26s cubic-bezier(.4,0,.2,1), opacity .2s ease";

  const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let panelMotionTimer = 0;


  // 让面板以小图标为中心缩放，收起和展开看起来是同一个东西。
  function setPanelOriginToIcon() {
    const panelRect = elements.panel.getBoundingClientRect();
    // 用布局位置而不是 getBoundingClientRect，图标的弹出动画会改变后者的尺寸。
    const icon = elements.miniIcon;
    const iconX = icon.offsetLeft + icon.offsetWidth / 2;
    const iconY = icon.offsetTop + icon.offsetHeight / 2;
    elements.panel.style.transformOrigin = `${iconX - panelRect.left}px ${iconY - panelRect.top}px`;
  }


  function minimizePanel() {
    if (state.ui.isMinimized) return;
    state.ui.isMinimized = true;
    UI._hideSettingsPanel();
    UI._hideAccountsPanel();
    const panel = elements.panel;
    const icon = elements.miniIcon;
    // 用户没拖动过小图标时，让它出现在面板原来的右上角，而不是远处的左下角。
    if (!getStoredJSON("miniIconPos", null)) {
      const rect = panel.getBoundingClientRect();
      icon.style.left = `${Math.max(8, rect.right - 48)}px`;
      icon.style.bottom = `${Math.max(8, window.innerHeight - rect.top - 48)}px`;
    }
    icon.style.display = "flex";
    clearTimeout(panelMotionTimer);
    if (prefersReducedMotion()) {
      panel.style.display = "none";
      return;
    }
    setPanelOriginToIcon();
    panel.style.transition = PANEL_MOTION;
    panel.classList.add("zdl-panel-hidden");
    icon.classList.remove("zdl-pop");
    void icon.offsetWidth;
    icon.classList.add("zdl-pop");
    panelMotionTimer = setTimeout(() => {
      if (state.ui.isMinimized) panel.style.display = "none";
    }, 260);
  }


  function restorePanel() {
    if (!state.ui.isMinimized) return;
    state.ui.isMinimized = false;
    const panel = elements.panel;
    clearTimeout(panelMotionTimer);
    if (prefersReducedMotion()) {
      panel.classList.remove("zdl-panel-hidden");
      panel.style.display = "";
      elements.miniIcon.style.display = "none";
      return;
    }
    // 先在未缩放状态下测量位置，再切到缩小状态，否则缩放中心会算错。
    panel.style.transition = "none";
    panel.classList.remove("zdl-panel-hidden");
    panel.style.display = "";
    setPanelOriginToIcon();
    panel.classList.add("zdl-panel-hidden");
    elements.miniIcon.style.display = "none";
    void panel.offsetWidth;
    panel.style.transition = PANEL_MOTION;
    panel.classList.remove("zdl-panel-hidden");
  }

  const PanelMethods = {
    createControlPanel() {
      if (document.getElementById("boss-pro-panel")) {
        document.getElementById("boss-pro-panel").remove();
      }
      elements.settingsPanel?.remove();
      elements.accountsPanel?.remove();
      elements.configDialog?.remove();
      elements.wizardDialog?.remove();
      this._accountsSnapshot = "";
      collapseInstances.length = 0;

      elements.panel = this._createPanel();

      const header = this._createHeader();
      const controls = document.createElement("div");
      controls.className = "zdl-delivery-controls";
      controls.append(this._createDeliveryControls());
      elements.log = this._createLogger();
      const logSection = document.createElement("div");
      logSection.className = "zdl-log-section";
      const logHeading = document.createElement("div");
      logHeading.className = "zdl-log-heading";
      const logTitle = document.createElement("span");
      logTitle.textContent = "投递日志";
      const clearLog = document.createElement("button");
      clearLog.type = "button";
      clearLog.className = "zdl-log-clear";
      clearLog.textContent = "清空";
      clearLog.title = "清空日志（不影响投递记录）";
      clearLog.addEventListener("click", () => {
        state.logEntries = [];
        saveLogEntries();
        elements.log.replaceChildren();
        this._refreshLogTabs();
      });
      // 日志筛选：全部 / 已投递 / 跳过，方便单独核对被跳过的岗位
      const tabs = document.createElement("div");
      tabs.className = "zdl-log-tabs";
      tabs.setAttribute("role", "group");
      tabs.setAttribute("aria-label", "筛选日志");
      [["all", "全部"], ["ok", "已投递"], ["skip", "跳过"]].forEach(([filter, label]) => {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "zdl-log-tab";
        tab.dataset.filter = filter;
        tab.dataset.label = label;
        tab.textContent = label;
        tab.addEventListener("click", () => {
          elements.log.dataset.filter = filter;
          this._refreshLogTabs();
          elements.log.scrollTop = elements.log.scrollHeight;
        });
        tabs.appendChild(tab);
      });
      elements.logTabs = tabs;
      const logTools = document.createElement("div");
      logTools.className = "zdl-log-tools";
      logTools.append(tabs, clearLog);
      logHeading.append(logTitle, logTools);
      logSection.append(logHeading, elements.log);
      const resizeHandle = document.createElement("div");
      resizeHandle.className = "zdl-resize-handle";

      elements.panel.append(header, controls, logSection, resizeHandle);
      document.body.appendChild(elements.panel);
      elements.settingsPanel = this._createSettingsPanel();
      document.body.appendChild(elements.settingsPanel);
      elements.accountsPanel = this._createAccountsPanel();
      document.body.appendChild(elements.accountsPanel);
      elements.configDialog = this._createConfigImportDialog();
      elements.wizardDialog = this._createWizardDialog();
      document.body.appendChild(elements.wizardDialog);
      document.body.appendChild(elements.configDialog);

      const savedSize = getStoredJSON("panelSize", null);
      if (savedSize) {
        elements.panel.style.width = savedSize.width + "px";
        elements.panel.style.height = savedSize.height + "px";
      }

      this._makeDraggable(elements.panel);
      this._makeResizable(elements.panel, resizeHandle);
      this._renderConfigTags();
    },


    _applyTheme() {
      CONFIG.COLORS = { primary: "#2f6fed", secondary: "#f6f8fc", accent: "#edf3ff", neutral: "#728096" };
      const c = CONFIG.COLORS;
      const root = document.documentElement.style;
      root.setProperty("--zdl-primary", c.primary);
      root.setProperty("--zdl-secondary", c.secondary);
      root.setProperty("--zdl-accent", c.accent);
      root.setProperty("--zdl-neutral", c.neutral);
      root.setProperty("--zdl-primary-rgb", "47, 111, 237");
      root.setProperty("--zdl-text-2", "#4f5f78");
      root.setProperty("--zdl-text-3", "#6b7a91");
      root.setProperty("--zdl-text-4", "#98a4b5");
      root.setProperty("--zdl-font", '-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",system-ui,sans-serif');
      root.setProperty("--zdl-shadow-lg", "0 1px 2px rgba(15,23,42,.04),0 18px 44px -14px rgba(15,23,42,.24)");
    },


    _createPanel() {
      const panel = document.createElement("div");
      panel.id = "boss-pro-panel";
      panel.className = "zdl-panel";
      return panel;
    },


    _createHeader() {
      const header = document.createElement("div");
      header.className = "zdl-header";
      const title = this._createTitle();
      const btnGroup = document.createElement("div");
      btnGroup.className = "zdl-btn-group";

      const pinBtn = this._createIconButton(UI_ICONS.pin, () => {
        state.ui.isPinned = !state.ui.isPinned;
        localStorage.setItem("panelPinned", state.ui.isPinned);
        if (state.ui.isPinned) {
          pinBtn.classList.add("pinned");
          pinBtn.title = "取消固定（点击页面不会收起）";
        } else {
          pinBtn.classList.remove("pinned");
          pinBtn.title = "固定面板";
        }
        pinBtn.setAttribute("aria-label", pinBtn.title);
        pinBtn.setAttribute("aria-pressed", String(state.ui.isPinned));
      }, state.ui.isPinned ? "取消固定（点击页面不会收起）" : "固定面板");
      if (state.ui.isPinned) pinBtn.classList.add("pinned");
      pinBtn.setAttribute("aria-pressed", String(state.ui.isPinned));
      elements.pinBtn = pinBtn;

      const historyBtn = this._createIconButton(UI_ICONS.history, () => this._showHistoryPanel(), "投递历史记录");
      elements.historyBtn = historyBtn;

      const repoLink = document.createElement("a");
      repoLink.className = "zdl-icon-btn svg-btn";
      repoLink.href = REPO_URL;
      repoLink.target = "_blank";
      repoLink.rel = "noopener noreferrer";
      repoLink.innerHTML = UI_ICONS.github;
      repoLink.title = "项目主页（GitHub）：使用说明、反馈问题";
      repoLink.setAttribute("aria-label", "打开项目 GitHub 主页");

      btnGroup.append(
        repoLink,
        this._createIconButton(UI_ICONS.help, () => this._showTutorial(), "新手教程"),
        historyBtn,
        pinBtn,
        this._createIconButton(UI_ICONS.minus, () => minimizePanel(), "最小化海投面板")
      );
      // 今日投递指标卡：大号数字 + 进度条，账号与本机统计收进右上角的账号按钮
      const kpi = document.createElement("div");
      kpi.className = "zdl-kpi";
      kpi.innerHTML = `
        <div class="zdl-kpi-top"><span class="zdl-kpi-label">今日投递</span></div>
        <div class="zdl-kpi-main">
          <span class="zdl-kpi-value">–</span><span class="zdl-kpi-target"></span>
          <span class="zdl-kpi-total"></span>
        </div>
        <div class="zdl-kpi-bar" role="progressbar" aria-label="今日投递进度" aria-valuemin="0" aria-valuemax="100"><i></i></div>`;
      elements.kpiValueEl = kpi.querySelector(".zdl-kpi-value");
      elements.kpiTargetEl = kpi.querySelector(".zdl-kpi-target");
      elements.kpiTotalEl = kpi.querySelector(".zdl-kpi-total");
      elements.kpiBarEl = kpi.querySelector(".zdl-kpi-bar");
      elements.accountsBtn = document.createElement("button");
      elements.accountsBtn.type = "button";
      elements.accountsBtn.className = "zdl-accounts-toggle";
      elements.accountsBtn.innerHTML = `<span class="zdl-accounts-label">本机账号</span>${UI_ICONS.chevron}`;
      elements.accountsBtn.setAttribute("aria-expanded", "false");
      elements.accountsBtn.setAttribute("aria-controls", "zdl-accounts-panel");
      elements.accountsBtn.addEventListener("click", () => {
        if (elements.accountsPanel.hidden) this._showAccountsPanel();
        else this._hideAccountsPanel();
      });
      kpi.querySelector(".zdl-kpi-top").appendChild(elements.accountsBtn);
      elements.accountStatusEl = document.createElement("span");
      elements.accountStatusEl.className = "zdl-account-status";
      kpi.appendChild(elements.accountStatusEl);
      header.append(title, btnGroup, kpi);
      return header;
    },


    _createTitle() {
      const wrapper = document.createElement("div");
      wrapper.className = "zdl-title-wrap";
      let version = "";
      try { version = typeof GM_info !== "undefined" ? GM_info.script?.version || "" : ""; } catch (error) {}
      wrapper.innerHTML = `<div class="zdl-title-icon">${SVG_ICON}</div>
        <div class="zdl-title-text">
          <h3>BOSS 海投助手</h3>
          ${version ? `<span class="zdl-version">v${version}</span>` : ""}
        </div>`;
      return wrapper;
    },


    _createDeliveryControls() {
      const container = document.createElement("div");
      const targetRow = document.createElement("div");
      targetRow.className = "zdl-delivery-target";
      const targetLabel = document.createElement("span");
      targetLabel.className = "zdl-target-label";
      targetLabel.textContent = "今日目标";
      elements.targetInput = document.createElement("input");
      elements.targetInput.type = "number";
      elements.targetInput.min = "1";
      elements.targetInput.max = CONFIG.DAILY_LIMIT.toString();
      elements.targetInput.value = state.targetCount;
      elements.targetInput.className = "zdl-target-input";
      elements.targetInput.addEventListener("change", () => {
        let val = parseInt(elements.targetInput.value, 10);
        if (!val || val < 1) val = CONFIG.DAILY_LIMIT;
        if (val > CONFIG.DAILY_LIMIT) val = CONFIG.DAILY_LIMIT;
        elements.targetInput.value = val.toString();
        state.targetCount = val;
        invalidateConfigUndo();
        localStorage.setItem("zdlTargetCount", val.toString());
        Delivery.render();
      });
      const targetUnit = document.createElement("span");
      targetUnit.className = "zdl-target-unit";
      targetUnit.textContent = "次";
      targetRow.append(targetLabel, elements.targetInput, targetUnit);
      elements.settingsBtn = this._createTextButton("筛选设置", () => {
        if (elements.settingsPanel.hidden) this._showSettingsPanel();
        else this._hideSettingsPanel();
      });
      elements.settingsBtn.className = "zdl-config-btn zdl-settings-open";
      elements.settingsBtn.innerHTML = `${UI_ICONS.settings}<span>筛选设置</span>`;
      targetRow.appendChild(elements.settingsBtn);
      elements.controlBtn = this._createTextButton("开始投递", () => { toggleProcess(); });
      elements.controlBtn.classList.add("zdl-control-btn");
      // 投递中显示：本次已投/跳过多少、正在看哪个岗位
      elements.runStatusEl = document.createElement("div");
      elements.runStatusEl.className = "zdl-run-status";
      elements.runStatusEl.hidden = true;
      elements.runStatusEl.setAttribute("aria-live", "polite");
      elements.runStatusEl.innerHTML = '<div class="zdl-run-head"><span class="zdl-run-dot"></span><span class="zdl-run-count"></span></div><div class="zdl-run-activity"></div>';
      container.append(targetRow, elements.controlBtn, elements.runStatusEl);
      return container;
    },


    // 更新日志筛选按钮上的数量，以及当前筛选下没有记录时的提示
    _refreshLogTabs() {
      const log = elements.log;
      if (!log || !elements.logTabs) return;
      const filter = log.dataset.filter || "all";
      const counts = {
        ok: log.querySelectorAll(".zdl-log-job.ok").length,
        skip: log.querySelectorAll(".zdl-log-job.skip").length,
      };
      elements.logTabs.querySelectorAll(".zdl-log-tab").forEach((tab) => {
        const n = counts[tab.dataset.filter];
        tab.textContent = n ? `${tab.dataset.label} ${n}` : tab.dataset.label;
        tab.classList.toggle("active", tab.dataset.filter === filter);
        tab.setAttribute("aria-pressed", String(tab.dataset.filter === filter));
      });
      if (filter !== "all" && !counts[filter]) log.dataset.empty = filter === "ok" ? "还没有投递记录" : "还没有跳过的岗位";
      else delete log.dataset.empty;
    },

    _createLogger() {
      const log = document.createElement("div");
      log.id = "pro-log";
      log.className = "zdl-log";
      return log;
    },


    _createTextButton(text, onClick) {
      const btn = document.createElement("button");
      btn.className = "zdl-btn-start";
      btn.textContent = text;
      btn.addEventListener("click", onClick);
      return btn;
    },


    _createIconButton(icon, onClick, title) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = icon.includes("<svg") ? "zdl-icon-btn svg-btn" : "zdl-icon-btn";
      btn.innerHTML = icon;
      btn.title = title;
      btn.setAttribute("aria-label", title);
      btn.addEventListener("click", onClick);
      return btn;
    },


    _makeDraggable(panel) {
      // 筛选div、日志div、缩放手柄及其内部不可拖动
      const NO_DRAG = "a, .zdl-delivery-controls, .zdl-log-section, .zdl-stats-strip, .zdl-scroll-wrap, .zdl-log, .zdl-resize-handle, button, input, select, textarea, .zdl-tag, .zdl-status-chip, .zdl-collapse-header, .zdl-tag-add-trigger, .zdl-tag-remove, .zdl-salary-select, .zdl-salary-input";

      panel.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (e.target.closest(NO_DRAG)) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const initialX = panel.offsetLeft;
        const initialY = panel.offsetTop;
        panel.style.transition = "none";
        panel.style.zIndex = "2147483647";

        // 只在拖动期间监听，松开即移除，反复打开面板也不会累积监听。
        const onMove = (event) => {
          panel.style.left = `${initialX + event.clientX - startX}px`;
          panel.style.top = `${initialY + event.clientY - startY}px`;
          panel.style.right = "auto";
        };
        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          panel.style.transition = "all 0.3s ease";
          panel.style.zIndex = "2147483646";
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    },


    _makeResizable(panel, handle) {
      let isResizing = false;
      let startX, startY, startW, startH;

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = panel.offsetWidth;
        startH = panel.offsetHeight;
        document.body.style.userSelect = "none";
      });

      document.addEventListener("mousemove", (e) => {
        if (!isResizing) return;
        const newW = Math.max(300, startW + e.clientX - startX);
        const newH = Math.max(360, startH + e.clientY - startY);
        panel.style.width = newW + "px";
        panel.style.height = newH + "px";
      });

      document.addEventListener("mouseup", () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.userSelect = "";
        localStorage.setItem("panelSize", JSON.stringify({
          width: panel.offsetWidth,
          height: panel.offsetHeight,
        }));
      });
    },


    createMiniIcon() {
      const savedPos = getStoredJSON("miniIconPos", null);

      elements.miniIcon = document.createElement("div");
      elements.miniIcon.className = "zdl-mini-icon";
      elements.miniIcon.innerHTML = SVG_ICON;
      elements.miniIcon.title = "展开海投助手";
      elements.miniIcon.setAttribute("role", "button");
      elements.miniIcon.setAttribute("aria-label", "展开海投助手");
      elements.miniIcon.tabIndex = 0;
      elements.miniIcon.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); restorePanel(); }
      });
      elements.miniIcon.addEventListener("animationend", () => elements.miniIcon.classList.remove("zdl-pop"));

      if (savedPos) {
        elements.miniIcon.style.left = savedPos.left + "px";
        elements.miniIcon.style.bottom = savedPos.bottom + "px";
      }

      let dragStartX, dragStartY, startLeft, startBottom, hasMoved;

      elements.miniIcon.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startLeft = elements.miniIcon.offsetLeft;
        startBottom = parseInt(window.getComputedStyle(elements.miniIcon).bottom, 10) || 40;
        hasMoved = false;
        elements.miniIcon.style.transition = "none";
        elements.miniIcon.style.cursor = "grabbing";
        e.preventDefault();

        const onMove = (e2) => {
          const dx = e2.clientX - dragStartX;
          const dy = dragStartY - e2.clientY;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved = true;
          elements.miniIcon.style.left = (startLeft + dx) + "px";
          elements.miniIcon.style.bottom = (startBottom + dy) + "px";
        };
        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          elements.miniIcon.style.transition = "";
          elements.miniIcon.style.cursor = "";
          if (hasMoved) {
            localStorage.setItem("miniIconPos", JSON.stringify({
              left: parseInt(elements.miniIcon.style.left, 10) || 40,
              bottom: parseInt(elements.miniIcon.style.bottom, 10) || 40,
            }));
          }
          if (!hasMoved) restorePanel();
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });

      document.body.appendChild(elements.miniIcon);
    },
  };

  const TUTORIAL_SEEN_KEY = "zdlTutorialSeen";

  let tutorialShownInPage = false;

  const TutorialMethods = {
    showTutorialIfNeeded() {
      if (tutorialShownInPage) return;
      try {
        if (localStorage.getItem(TUTORIAL_SEEN_KEY) === "1") return;
      } catch (error) {
        console.warn("读取新手教程状态失败:", error);
      }
      this._showTutorial();
    },


    _showTutorial() {
      if (elements.configDialog?.open) return;
      if (document.getElementById("zdl-tutorial")) return;
      const panel = elements.panel;
      const settingsPanel = elements.settingsPanel;
      const settingsScroll = elements.settingsScroll;
      let layoutPanel = panel;
      let scrollWrap = null;
      const saved = {
        panelStyle: panel.getAttribute("style"),
        miniStyle: elements.miniIcon.getAttribute("style"),
        settingsStyle: settingsPanel.getAttribute("style"),
        settingsHidden: settingsPanel.hidden,
        accountsHidden: elements.accountsPanel.hidden,
        minimized: state.ui.isMinimized,
        scrollTop: settingsScroll.scrollTop,
        scrollLeft: settingsScroll.scrollLeft,
        sections: collapseInstances.map((item) => ({ item, open: item.isOpen, className: item.body.className, arrow: item.arrow.textContent })),
      };
      const initialRect = panel.getBoundingClientRect();
      let settingsRect = null;
      const sectionButton = (input) => input.closest(".zdl-tag-section").querySelector(".zdl-tag-add-trigger");
      const steps = [
        { title: "固定面板", text: "固定后，点击页面也不会收起。", target: () => elements.pinBtn },
        { title: "打开筛选设置", text: "点这里设置岗位条件。", target: () => elements.settingsBtn },
        { title: "第一次用？试试求职向导", text: "选身份、方向和技术栈，快速生成基础规则；之后在筛选设置里微调。", settings: true, target: () => elements.wizardBtn },
        { title: "添加职位关键词", text: "职位名「必须包含」要全部命中，「包含任一」命中一个即可。", settings: true, section: 1, target: () => sectionButton(elements.coarseRequiredInput) },
        { title: "排除不想要的岗位", text: "职位详情命中排除词，就会跳过。", settings: true, section: 2, target: () => sectionButton(elements.detailBlockedInput) },
        { title: "筛选招聘者", text: "勾选你接受的活跃状态。", settings: true, section: 3, target: () => settingsPanel.querySelector("#recruiter-status-select .zdl-status-chip") },
        { title: "设置今日目标", text: "今天一共要投多少次，到量自动停止。", target: () => elements.targetInput },
        { title: "复制或导入配置", text: "复制配置分享给别人，对方导入后即可使用。", settings: true, target: () => settingsPanel.querySelector(".zdl-config-buttons") },
        { title: "准备好再开始", text: "点“开始投递”启动；教程不会代你点击。", target: () => elements.controlBtn },
      ];
      const dialog = document.createElement("dialog");
      dialog.id = "zdl-tutorial";
      dialog.className = "zdl-tutorial";
      dialog.setAttribute("aria-labelledby", "zdl-tutorial-title");
      dialog.innerHTML = `
        <div class="zdl-tutorial-focus" aria-hidden="true"></div>
        <svg class="zdl-tutorial-arrow" aria-hidden="true">
          <defs><marker id="zdl-tutorial-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--zdl-primary)" stroke-width="1.5"/></marker></defs>
          <path class="zdl-tutorial-line" marker-end="url(#zdl-tutorial-arrowhead)"/>
        </svg>
        <div class="zdl-tutorial-card" aria-live="polite">
          <div class="zdl-tutorial-header">
            <span class="zdl-tutorial-step"></span>
            <button type="button" class="zdl-tutorial-close" data-tutorial-action="close" aria-label="关闭教程">×</button>
          </div>
          <h2 id="zdl-tutorial-title"></h2>
          <p class="zdl-tutorial-desc"></p>
          <div class="zdl-tutorial-footer">
            <button type="button" class="zdl-tutorial-btn" data-tutorial-action="skip">跳过</button>
            <div class="zdl-tutorial-navigation">
              <button type="button" class="zdl-tutorial-btn" data-tutorial-action="prev">上一步</button>
              <button type="button" class="zdl-tutorial-btn primary" data-tutorial-action="next">下一步</button>
            </div>
          </div>
        </div>`;
      const card = dialog.querySelector(".zdl-tutorial-card");
      const focus = dialog.querySelector(".zdl-tutorial-focus");
      const line = dialog.querySelector(".zdl-tutorial-line");
      const previous = dialog.querySelector('[data-tutorial-action="prev"]');
      const next = dialog.querySelector('[data-tutorial-action="next"]');
      let index = 0;
      let frame = 0;
      const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
      const fitRoot = (root, rect) => {
        const width = Math.min(rect.width || 386, window.innerWidth - 24);
        const height = Math.min(rect.height || 446, window.innerHeight - 24);
        Object.assign(root.style, {
          boxSizing: "border-box", minWidth: "0", minHeight: "0", maxWidth: "none", maxHeight: "none",
          width: `${width}px`, height: `${height}px`,
          left: `${clamp(rect.left, 12, window.innerWidth - width - 12)}px`,
          top: `${clamp(rect.top, 12, window.innerHeight - height - 12)}px`,
          right: "auto", bottom: "auto", display: root === panel ? "flex" : "", transition: "none",
        });
      };
      const fitPanel = () => {
        fitRoot(panel, initialRect);
        if (layoutPanel === settingsPanel && settingsRect) fitRoot(settingsPanel, settingsRect);
      };
      const position = () => {
        const target = steps[index].target();
        if (!target?.isConnected || !dialog.open) return false;
        let rect = target.getBoundingClientRect();
        let clip = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        if (scrollWrap?.contains(target)) {
          const visible = scrollWrap.getBoundingClientRect();
          clip = { left: visible.left, top: visible.top, right: visible.left + scrollWrap.clientWidth, bottom: visible.top + scrollWrap.clientHeight };
          if (rect.top < clip.top + 6) scrollWrap.scrollTop -= clip.top + 6 - rect.top;
          else if (rect.bottom > clip.bottom - 6) scrollWrap.scrollTop += rect.bottom - clip.bottom + 6;
          if (rect.left < clip.left + 6) scrollWrap.scrollLeft -= clip.left + 6 - rect.left;
          else if (rect.right > clip.right - 6) scrollWrap.scrollLeft += rect.right - clip.right + 6;
          rect = target.getBoundingClientRect();
        }
        if (!rect.width || !rect.height) return false;
        const anchor = {
          left: Math.max(6, clip.left, rect.left - 5), top: Math.max(6, clip.top, rect.top - 5),
          right: Math.min(window.innerWidth - 6, clip.right, rect.right + 5), bottom: Math.min(window.innerHeight - 6, clip.bottom, rect.bottom + 5),
        };
        if (anchor.right <= anchor.left || anchor.bottom <= anchor.top) return false;
        Object.assign(focus.style, { left: `${anchor.left}px`, top: `${anchor.top}px`, width: `${anchor.right - anchor.left}px`, height: `${anchor.bottom - anchor.top}px` });
        const { width, height } = card.getBoundingClientRect();
        const centerX = (anchor.left + anchor.right) / 2;
        const centerY = (anchor.top + anchor.bottom) / 2;
        const gap = 24;
        const panelRect = layoutPanel.getBoundingClientRect();
        const candidates = [
          [panelRect.left - width - gap, centerY - height / 2],
          [panelRect.right + gap, centerY - height / 2],
          [anchor.left - width - gap, centerY - height / 2],
          [anchor.right + gap, centerY - height / 2],
          [centerX - width / 2, anchor.bottom + gap],
          [centerX - width / 2, anchor.top - height - gap],
        ].map(([x, y], order) => {
          const left = clamp(x, 12, window.innerWidth - width - 12);
          const top = clamp(y, 12, window.innerHeight - height - 12);
          const overlap = Math.max(0, Math.min(left + width, anchor.right) - Math.max(left, anchor.left))
            * Math.max(0, Math.min(top + height, anchor.bottom) - Math.max(top, anchor.top));
          return { left, top, right: left + width, bottom: top + height, score: overlap * 1000 + Math.abs(left - x) + Math.abs(top - y) + order };
        }).sort((a, b) => a.score - b.score);
        const placement = candidates[0];
        Object.assign(card.style, { left: `${placement.left}px`, top: `${placement.top}px` });
        const edge = (box, x, y) => {
          const cx = (box.left + box.right) / 2;
          const cy = (box.top + box.bottom) / 2;
          const dx = x - cx, dy = y - cy;
          const ratio = Math.min((box.right - box.left) / 2 / (Math.abs(dx) || 0.001), (box.bottom - box.top) / 2 / (Math.abs(dy) || 0.001));
          return [cx + dx * ratio, cy + dy * ratio];
        };
        const start = edge(placement, centerX, centerY);
        const end = edge(anchor, (placement.left + placement.right) / 2, (placement.top + placement.bottom) / 2);
        line.setAttribute("d", `M${start[0]},${start[1]} L${end[0]},${end[1]}`);
        return true;
      };
      const schedulePosition = () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!position()) closeTutorial();
        });
      };
      const onResize = () => { fitPanel(); schedulePosition(); };
      const restoreStyle = (node, value) => {
        if (value === null) node.removeAttribute("style");
        else node.setAttribute("style", value);
      };
      const closeTutorial = () => {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", schedulePosition, true);
        cancelAnimationFrame(frame);
        if (dialog.open) dialog.close();
        dialog.remove();
        saved.sections.forEach(({ item, open, className, arrow }) => {
          item.isOpen = open;
          item.body.className = className;
          item.arrow.textContent = arrow;
        });
        restoreStyle(panel, saved.panelStyle);
        restoreStyle(elements.miniIcon, saved.miniStyle);
        restoreStyle(settingsPanel, saved.settingsStyle);
        settingsPanel.hidden = saved.settingsHidden;
        state.ui.isMinimized = saved.minimized;
        settingsScroll.scrollTop = saved.scrollTop;
        settingsScroll.scrollLeft = saved.scrollLeft;
        if (!saved.accountsHidden) this._showAccountsPanel();
      };
      const renderStep = () => {
        collapseInstances.forEach((item, i) => {
          item.isOpen = i === steps[index].section;
          item.body.classList.toggle("collapsed", !item.isOpen);
          item.arrow.textContent = item.isOpen ? "▼" : "▶";
        });
        if (steps[index].settings) {
          this._showSettingsPanel(true);
          if (!settingsRect) settingsRect = settingsPanel.getBoundingClientRect();
          layoutPanel = settingsPanel;
          scrollWrap = settingsScroll;
        } else {
          this._hideSettingsPanel();
          layoutPanel = panel;
          scrollWrap = null;
        }
        fitPanel();
        dialog.querySelector(".zdl-tutorial-step").textContent = `${index + 1} / ${steps.length}`;
        dialog.querySelector("#zdl-tutorial-title").textContent = steps[index].title;
        dialog.querySelector(".zdl-tutorial-desc").textContent = steps[index].text;
        previous.disabled = index === 0;
        next.textContent = index === steps.length - 1 ? "完成" : "下一步";
        return position();
      };
      dialog.addEventListener("click", (event) => event.stopPropagation());
      dialog.querySelector('[data-tutorial-action="close"]').addEventListener("click", closeTutorial);
      dialog.querySelector('[data-tutorial-action="skip"]').addEventListener("click", closeTutorial);
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeTutorial(); });
      previous.addEventListener("click", () => {
        if (index > 0) { index--; if (!renderStep()) closeTutorial(); }
      });
      next.addEventListener("click", () => {
        if (index === steps.length - 1) closeTutorial();
        else { index++; if (!renderStep()) closeTutorial(); }
      });
      this._hideAccountsPanel();
      state.ui.isMinimized = false;
      elements.miniIcon.style.display = "none";
      fitPanel();
      document.body.appendChild(dialog);
      try {
        dialog.showModal();
        if (!renderStep()) throw new Error("找不到可见的引导目标");
      } catch (error) {
        closeTutorial();
        console.warn("新手教程显示失败:", error);
        return;
      }
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", schedulePosition, true);
      tutorialShownInPage = true;
      try {
        localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
      } catch (error) {
        console.warn("保存新手教程状态失败:", error);
      }
      next.focus({ preventScroll: true });
    },
  };

  const WizardMethods = {
    // 求职向导：几个选择题生成规则，应用前预览改动，应用后可在底部撤销
    // 求职向导：弹窗里回答几个选择题生成基础规则，应用前预览改动，应用后可在底部撤销
    _createWizardDialog() {
      const KEY = "zdlWizardAnswers";
      let answers = { ...defaultWizardAnswers(), ...getStoredJSON(KEY, {}) };
      const save = () => { try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch (error) {} };

      const dialog = document.createElement("dialog");
      dialog.id = "zdl-wizard";
      dialog.className = "zdl-import-dialog zdl-wizard";
      dialog.setAttribute("aria-labelledby", "zdl-wizard-title");
      const header = document.createElement("div");
      header.className = "zdl-settings-header";
      const heading = document.createElement("div");
      heading.className = "zdl-wizard-heading";
      heading.innerHTML = `<span class="zdl-wizard-mark">${UI_ICONS.wand}</span>
        <span class="zdl-wizard-title"><strong id="zdl-wizard-title">求职向导</strong><small>选几个选项，快速生成基础筛选规则，之后可在筛选设置里微调</small></span>`;
      const closeBtn = this._createIconButton(UI_ICONS.close, () => dialog.close(), "关闭求职向导");
      header.append(heading, closeBtn);
      const body = document.createElement("div");
      body.className = "zdl-wizard-body zdl-import-body";
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); dialog.close(); });
      dialog.addEventListener("click", (event) => event.stopPropagation());
      dialog.addEventListener("close", () => elements.wizardBtn?.focus({ preventScroll: true }));

      const chips = (options, isOn, toggle) => {
        const row = document.createElement("div");
        row.className = "zdl-wizard-chips";
        options.forEach(([key, label]) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "zdl-status-chip";
          const check = document.createElement("span");
          check.className = "zdl-status-check";
          check.setAttribute("aria-hidden", "true");
          chip.append(check, label);
          const render = () => {
            chip.classList.toggle("active", isOn(key));
            chip.setAttribute("aria-pressed", String(isOn(key)));
          };
          chip.addEventListener("click", () => { toggle(key); render(); onChange(); });
          render();
          row.appendChild(chip);
        });
        return row;
      };
      const listToggle = (field) => (key) => {
        const list = answers[field];
        answers[field] = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
      };
      const step = (index, title, desc, ...content) => {
        const wrap = document.createElement("div");
        wrap.className = "zdl-wizard-step";
        const label = document.createElement("div");
        label.className = "zdl-wizard-step-label";
        label.innerHTML = `<span class="zdl-wizard-index">${index}</span><span>${title}</span>${desc ? `<small>${desc}</small>` : ""}`;
        wrap.append(label, ...content);
        return wrap;
      };
      const checkbox = (label, field) => {
        const wrap = document.createElement("label");
        wrap.className = "zdl-wizard-check";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = !!answers[field];
        input.addEventListener("change", () => { answers[field] = input.checked; onChange(); });
        wrap.append(input, label);
        return wrap;
      };

      // ① 身份
      const identityRow = chips([["intern", "实习"], ["campus", "校招/应届"], ["social", "社招"]],
        (k) => answers.identities.includes(k), listToggle("identities"));
      const years = document.createElement("label");
      years.className = "zdl-wizard-inline";
      const yearsSelect = document.createElement("select");
      yearsSelect.className = "zdl-wizard-select";
      [["1", "1 年以内"], ["3", "3 年以内"], ["5", "5 年以内"], ["all", "不限年限"]].forEach(([value, text]) => yearsSelect.add(new Option(text, value)));
      yearsSelect.value = answers.maxYears;
      yearsSelect.addEventListener("change", () => { answers.maxYears = yearsSelect.value; onChange(); });
      years.append("社招接受经验要求", yearsSelect);
      const step1 = step("1", "你在找什么", "可多选", identityRow, years, checkbox("也投没写明类型的岗位", "includeOpen"));
      // ② 方向
      const step2 = step("2", "想做什么方向", "可多选，没选的方向会被排除",
        chips(WIZARD_DIRECTIONS.map((d) => [d.key, d.label]), (k) => answers.directions.includes(k), listToggle("directions")));
      // ③ 技术栈
      const step3 = step("3", "用什么技术栈", "可多选，可跳过；职位描述要提到其中之一",
        chips(WIZARD_STACKS.map((t) => [t.key, t.label]), (k) => answers.stacks.includes(k), listToggle("stacks")));
      // 其他
      const salary = document.createElement("label");
      salary.className = "zdl-wizard-inline";
      const salaryInput = document.createElement("input");
      salaryInput.type = "number";
      salaryInput.min = "0";
      salaryInput.placeholder = "不限";
      salaryInput.className = "zdl-wizard-number";
      salaryInput.value = answers.minSalary;
      salaryInput.addEventListener("change", () => { answers.minSalary = salaryInput.value; onChange(); });
      salary.append("最低月薪", salaryInput, "K（日薪按 24 天折算）");
      const extras = document.createElement("div");
      extras.className = "zdl-wizard-extras";
      extras.append(checkbox("可面议", "negotiable"), checkbox("只投 HR / 招聘人员", "onlyHr"),
        checkbox("只投 3 天内活跃的招聘者", "recentActive"), checkbox("排除销售、客服、运营等非技术岗", "excludeNonTech"));
      const step4 = step("4", "其他", "可选", salary, extras);

      // 生成与预览
      const actions = document.createElement("div");
      actions.className = "zdl-wizard-actions";
      const hint = document.createElement("span");
      hint.className = "zdl-wizard-hint";
      const generate = document.createElement("button");
      generate.type = "button";
      generate.className = "zdl-config-btn zdl-config-primary";
      generate.textContent = "预览改动";
      actions.append(hint, generate);
      const review = document.createElement("div");
      review.className = "zdl-wizard-review";
      review.hidden = true;

      let pendingJson = "";
      const onChange = () => {
        save();
        years.hidden = !answers.identities.includes("social");
        const ready = answers.identities.length && answers.directions.length;
        generate.disabled = !ready;
        hint.textContent = ready ? "会覆盖岗位类型、职位名、技术栈、薪资和招聘者规则" : "至少选一个身份和一个方向";
        review.hidden = true;
        pendingJson = "";
      };

      generate.addEventListener("click", () => {
        let config;
        try {
          const json = JSON.stringify({ type: "zdl-boss-config", version: 1, config: { ...getCurrentConfig(), ...generateWizardConfig(answers) } });
          config = parseConfig(json);
          pendingJson = json;
        } catch (error) {
          review.hidden = false;
          review.textContent = `生成失败：${error.message}`;
          return;
        }
        const changes = getConfigChanges(config);
        review.hidden = false;
        review.replaceChildren();
        const title = document.createElement("p");
        title.className = "zdl-wizard-review-title";
        title.textContent = changes.length ? `将更新 ${changes.length} 项设置，排除公司、工作地、详情排除词和今日目标保持不变` : "和当前规则一致，无需应用";
        const diff = document.createElement("dl");
        diff.className = "zdl-config-diff";
        changes.forEach((change) => {
          const row = document.createElement("div");
          const dt = document.createElement("dt");
          dt.textContent = change.label;
          const dd = document.createElement("dd");
          const before = Object.assign(document.createElement("span"), { className: "zdl-config-before", textContent: change.before });
          const arrow = Object.assign(document.createElement("span"), { className: "zdl-config-arrow", textContent: "→" });
          const after = Object.assign(document.createElement("strong"), { textContent: change.after });
          dd.append(before, arrow, after);
          row.append(dt, dd);
          diff.appendChild(row);
        });
        const buttons = document.createElement("div");
        buttons.className = "zdl-wizard-actions";
        const cancel = this._createTextButton("取消", () => { review.hidden = true; });
        cancel.className = "zdl-config-btn";
        const apply = this._createTextButton("应用到规则", () => {
          try {
            const count = importConfig(pendingJson);
            this._refreshConfigFilters();
            this._updateConfigControls();
            this._setConfigStatus(count ? "已按向导生成规则，可撤销" : "规则无变化");
            dialog.close();
            if (elements.settingsPanel.hidden) this._showSettingsPanel();
            CoarsePreview.render();
          } catch (error) {
            title.textContent = error.message;
            title.classList.add("error");
          }
        });
        apply.className = "zdl-config-btn zdl-config-primary";
        apply.disabled = !changes.length || state.isRunning || !!state.activeRun;
        buttons.append(cancel, apply);
        review.append(title, diff, buttons);
        review.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });

      body.append(step1, step2, step3, step4, actions, review);
      dialog.append(header, body);
      onChange();
      dialog.zdlOpen = () => {
        if (dialog.open) return;
        onChange();
        try { dialog.showModal(); } catch (error) { return; }
        generate.focus({ preventScroll: true });
      };
      return dialog;
    },


    _openWizard() {
      this._hideConfigImport(false);
      elements.wizardDialog?.zdlOpen();
    },
  };

  // 界面方法按功能分在 ui/ 下的各个文件里，这里拼成同一个 UI 对象，方法之间照常用 this 互相调用。
  const UI = {
    init() {
      this._applyTheme();
      this.createControlPanel();
      this.createMiniIcon();

      document.addEventListener("click", (e) => {
        if (!e.isTrusted) return;
        if (document.getElementById("zdl-tutorial")?.contains(e.target)) return;
        if (elements.configDialog?.contains(e.target)) return;
        if (elements.wizardDialog?.contains(e.target)) return;
        if (this._confirmDialog?.contains(e.target)) return;
        if (elements.settingsPanel?.contains(e.target)) return;
        if (elements.accountsPanel?.contains(e.target)) return;
        if (elements.panel && !elements.panel.contains(e.target)) {
          this._hideSettingsPanel();
          this._hideAccountsPanel();
        }
        if (state.ui.isMinimized) return;
        if (state.ui.isPinned) return;
        if (elements.panel && elements.panel.contains(e.target)) return;
        if (elements.miniIcon && elements.miniIcon.contains(e.target)) return;
        if (document.getElementById("zdl-history-panel")?.contains(e.target)) return;
        minimizePanel();
      });
      window.addEventListener("keydown", (e) => {
        if (elements.configDialog.open || elements.wizardDialog?.open || this._confirmDialog?.open) return;
        if (e.key === "Escape" && !document.getElementById("zdl-tutorial")
          && (!elements.settingsPanel.hidden || !elements.accountsPanel.hidden)) {
          e.preventDefault();
          e.stopPropagation();
          if (!elements.accountsPanel.hidden) this._hideAccountsPanel(true);
          else this._hideSettingsPanel(true);
        }
      }, true);
      setInterval(() => CoarsePreview.poll(), 1500);
      window.addEventListener("resize", () => {
        if (!elements.settingsPanel.hidden && !document.getElementById("zdl-tutorial")) this._positionSettingsPanel();
        if (!elements.accountsPanel.hidden && !document.getElementById("zdl-tutorial")) this._positionSettingsPanel(elements.accountsPanel);
      });
    },
  };

  Object.assign(UI, ConfirmMethods, PanelMethods, AccountsMethods, TutorialMethods, SettingsMethods, ConfigShareMethods, WizardMethods, HistoryMethods);

  const DELIVERY_STATS_KEY = "zdlDeliveryStatsV1";
  const CURRENT_ACCOUNT_KEY = "zdlAccountPageV1:";
  const DELIVERY_LOCK_NAME = "zdl-boss-delivery";
  const Delivery = {
    normalizeUid(value) {
      const id = String(value ?? "");
      return /^[1-9]\d*$/.test(id) ? id : "";
    },

    maskUid(value) {
      const id = this.normalizeUid(value);
      if (!id) return "未知账号";
      return id.length <= 4 ? "*".repeat(id.length)
        : id.slice(0, 2) + "*".repeat(id.length - 4) + id.slice(-2);
    },

    inlineUid(text) {
      const assignment = /(?:^|[;\n])\s*(?:(?:var|let|const)\s+)?(?:window\.)?_PAGE\s*=\s*\{/.exec(text);
      if (!assignment) return "";
      let depth = 1, quote = "", escaped = false, fieldStart = true;
      const start = assignment.index + assignment[0].length;
      for (let i = start; i < text.length && depth; i++) {
        const char = text[i];
        if (quote) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === quote) quote = "";
          continue;
        }
        if (char === "/" && text[i + 1] === "/") {
          const end = text.indexOf("\n", i + 2);
          i = end < 0 ? text.length : end;
          continue;
        }
        if (char === "/" && text[i + 1] === "*") {
          const end = text.indexOf("*/", i + 2);
          if (end < 0) return "";
          i = end + 1;
          continue;
        }
        if (depth === 1 && fieldStart) {
          const match = text.slice(i).match(/^\s*(?:uid|"uid"|'uid')\s*:\s*(?:"([1-9]\d*)"|'([1-9]\d*)'|([1-9]\d*))\s*(?=[,}])/);
          if (match) return match[1] || match[2] || match[3];
          if (!/\s/.test(char)) fieldStart = false;
        }
        if (char === '"' || char === "'" || char === "`") quote = char;
        else if (char === "{" || char === "[") depth++;
        else if (char === "}" || char === "]") depth--;
        if (char === "," && depth === 1) fieldStart = true;
      }
      return "";
    },

    readUid() {
      // SPA 插入的 script 可能没有执行，只提取 _PAGE 中的 uid，不执行脚本。
      const ids = new Set();
      for (const script of document.querySelectorAll("script:not([src])")) {
        const id = this.inlineUid(script.textContent);
        if (id) ids.add(id);
      }
      let runtimeId = "";
      try { runtimeId = this.normalizeUid(window._PAGE?.uid); } catch (error) {}
      if (runtimeId) ids.add(runtimeId);
      return ids.size === 1 ? [...ids][0] : "";
    },

    syncAccountSignal(id) {
      const published = id && state.account.publishedUid !== id;
      // 各页分开发布，避免旧页面的并发写入覆盖新账号公告。
      if (published) {
        const key = `${CURRENT_ACCOUNT_KEY}${state.account.pageStartedAt}:${state.account.signalId}`;
        localStorage.setItem(key, JSON.stringify({ uid: id, pageStartedAt: state.account.pageStartedAt }));
        state.account.publishedUid = id;
      }
      const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
        .filter((key) => key?.startsWith(CURRENT_ACCOUNT_KEY));
      const olderKeys = [];
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        const signal = JSON.parse(raw);
        if (!this.normalizeUid(signal?.uid) || !Number.isFinite(signal.pageStartedAt)) throw new Error("账号同步记录异常");
        if (signal.pageStartedAt < state.account.pageStartedAt) olderKeys.push(key);
        else if (id && signal.uid !== id) {
          state.account.needsReload = true;
          stopProcess();
        }
      }
      // 新页面只清理比自己旧的公告，不触碰账号投递记录。
      if (published && !state.account.needsReload) olderKeys.forEach((key) => localStorage.removeItem(key));
    },

    readStats() {
      const raw = localStorage.getItem(DELIVERY_STATS_KEY);
      const validRecord = (record) => record && typeof record.dailyDate === "string"
        && Number.isSafeInteger(record.dailyCount) && record.dailyCount >= 0
        && Number.isSafeInteger(record.totalCount) && record.totalCount >= record.dailyCount;
      if (raw !== null) {
        const stats = JSON.parse(raw);
        if (stats?.version !== 1 || !validRecord(stats.machine) || !stats.accounts
          || typeof stats.accounts !== "object" || Array.isArray(stats.accounts)
          || Object.entries(stats.accounts).some(([id, record]) => !this.normalizeUid(id) || !validRecord(record))) {
          throw new Error("投递记录格式异常，请先备份并检查本机记录");
        }
        return stats;
      }
      // 旧记录没有账号归属，只继承到本机统计，保留原 key 作为备份。
      const machine = {
        dailyDate: localStorage.getItem("deliveryDate") || "",
        dailyCount: Number(localStorage.getItem("dailyDeliveryCount") || "0"),
        totalCount: Number(localStorage.getItem("totalDeliveryCount") || "0"),
      };
      if (!validRecord(machine)) throw new Error("旧投递次数异常，请先备份并检查本机记录");
      return { version: 1, machine, accounts: {} };
    },

    forToday(record) {
      const today = new Date().toLocaleDateString();
      return {
        dailyDate: today,
        dailyCount: record?.dailyDate === today ? record.dailyCount : 0,
        totalCount: record?.totalCount || 0,
      };
    },

    sync() {
      const id = this.readUid();
      if (state.account.id && id !== state.account.id) {
        state.account.needsReload = true;
        stopProcess();
      }
      state.account.id = id;
      if (!state.account.writeFailed) {
        try {
          this.syncAccountSignal(id);
          const stats = this.readStats();
          Object.assign(state.delivery, this.forToday(stats.accounts[id]));
          Object.assign(state.machineDelivery, this.forToday(stats.machine));
          state.account.error = "";
        } catch (error) {
          state.account.error = "无法读取投递记录，请检查本机存储后刷新";
          stopProcess();
        }
      }
      this.render();
    },

    render() {
      const known = !!state.account.id;
      const daily = state.delivery.dailyCount;
      const target = state.targetCount;
      if (elements.kpiValueEl) {
        const pct = known && target ? Math.min(100, Math.round((daily / target) * 100)) : 0;
        elements.kpiValueEl.textContent = known ? String(daily) : "–";
        elements.kpiTargetEl.textContent = `/ ${target} 次`;
        elements.kpiTotalEl.textContent = known ? `累计 ${state.delivery.totalCount} 次` : "";
        elements.kpiBarEl.firstElementChild.style.width = `${pct}%`;
        elements.kpiBarEl.setAttribute("aria-valuenow", String(pct));
        elements.kpiBarEl.classList.toggle("done", known && daily >= target);
      }
      if (elements.accountsBtn) {
        elements.accountsBtn.querySelector(".zdl-accounts-label").textContent = known ? `账号 ${this.maskUid(state.account.id)}` : "未识别账号";
        elements.accountsBtn.title = `本机 · 今日 ${state.machineDelivery.dailyCount} 次 · 累计 ${state.machineDelivery.totalCount} 次（点击查看各账号）`;
      }
      if (elements.accountStatusEl) elements.accountStatusEl.textContent = state.account.error
        || (state.account.needsReload ? "账号已变化，请刷新页面后启动" : !state.account.id ? "请确认已登录 BOSS，等待账号信息加载"
          : !isJobsPage() && !state.activeRun ? "当前不是职位页，请切换到「职位」页后启动" : "");
      if (elements.controlBtn) {
        const label = state.activeRun
          ? (state.isRunning ? "停止投递" : state.activeRun.started ? "正在停止…" : "准备中…") : "开始投递";
        if (elements.controlBtn.dataset.label !== label) {
          elements.controlBtn.dataset.label = label;
          elements.controlBtn.innerHTML = `${state.activeRun ? UI_ICONS.stop : UI_ICONS.play}<span>${label}</span>`;
        }
        elements.controlBtn.disabled = !state.isRunning && (!!state.activeRun || !state.account.id
          || state.account.needsReload || !!state.account.error || !isJobsPage());
        elements.controlBtn.classList.toggle("is-running", !!state.activeRun);
      }
      if (elements.miniIcon) {
        const label = state.isRunning ? "海投助手投递中，点击展开" : "展开海投助手";
        elements.miniIcon.classList.toggle("running", state.isRunning);
        elements.miniIcon.title = label;
        elements.miniIcon.setAttribute("aria-label", label);
      }
      RunStatus.render();
      if (elements.accountsPanel && !elements.accountsPanel.hidden) UI._renderAccountsPanel();
      if (elements.configImportBtn) UI._updateConfigControls();
    },

    isCurrent(run, allowStopped = false) {
      if (!run || state.activeRun !== run || state.account.needsReload || state.account.error) return false;
      if (!isJobsPage()) {
        if (state.isRunning) Core.log("已离开职位页，投递已停止");
        stopProcess(run);
        return false;
      }
      try { this.syncAccountSignal(run.uid); } catch (error) { this.sync(); return false; }
      if (state.account.needsReload) return false;
      if (this.readUid() !== run.uid) {
        this.sync();
        stopProcess(run);
        return false;
      }
      if (state.delivery.dailyDate !== new Date().toLocaleDateString()) this.sync();
      return !state.account.error && (allowStopped || state.isRunning);
    },

    prepare(run) {
      const stats = this.readStats();
      if (!stats.accounts[run.uid]) stats.accounts[run.uid] = this.forToday();
      localStorage.setItem(DELIVERY_STATS_KEY, JSON.stringify(stats));
      this.sync();
    },

    recordSuccess(run) {
      if (!this.isCurrent(run, true)) return false;
      const stats = this.readStats();
      const account = this.forToday(stats.accounts[run.uid]);
      const machine = this.forToday(stats.machine);
      account.dailyCount++; account.totalCount++;
      machine.dailyCount++; machine.totalCount++;
      stats.accounts[run.uid] = account;
      stats.machine = machine;
      try {
        // 账号与本机统计在同一条记录内一次写入，避免只更新一方。
        localStorage.setItem(DELIVERY_STATS_KEY, JSON.stringify(stats));
      } catch (error) {
        state.account.writeFailed = true;
        state.account.error = "本次成功的计数保存失败，已停止；请核对记录";
        stopProcess(run);
        throw error;
      }
      Object.assign(state.delivery, account);
      Object.assign(state.machineDelivery, machine);
      this.render();
      return true;
    },
  };

  function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `zdl-notify ${type === "success" ? "success" : "error"}`;
    notification.setAttribute("role", type === "success" ? "status" : "alert");
    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => notification.classList.add("show"));
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, type === "success" ? 2200 : 3500);
  }

  // 打开过详情的岗位卡片会记下“哪个账号、用哪套规则判断过”。同一套规则下再开始投递时跳过，
  // 中途停下再继续能接着投；改了规则后重新判断。详情加载超时的只在本次投递里跳过。
  function rulesKey() {
    const { targetCount, ...rules } = getCurrentConfig();
    const text = JSON.stringify(rules);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
    return hash.toString(36);
  }

  const isHandled = (card, run) => card.dataset.zdlProcessed === run.mark || card.dataset.zdlTimeout === run.id;

  // 开始投递时日志里的规则说明：第一行是摘要，其余行折叠起来，点开看每条规则的完整内容。
  function filterSummary() {
    const config = getCurrentConfig();
    const count = (key) => config[key].length;
    const group = (label, keys) => {
      const parts = keys.filter(([key]) => count(key)).map(([key, name]) => `${name} ${count(key)}`);
      return parts.length ? `${label}${parts.join("/")}` : "";
    };
    const salary = config.salaryFilter.type !== "none" || config.salaryFilter.negotiable === false;
    const activity = count("recruiterActivityStatus") < RECRUITER_STATUS_OPTIONS.length;
    const summary = [
      jobTypeFilterActive() ? formatConfigValue("jobTypeFilter", config.jobTypeFilter) : "",
      group("职位名 ", [["includeTags", "包含"], ["coarseRequiredTags", "必须"], ["coarseBlockedTags", "排除"]]),
      count("locationTags") ? `工作地 ${config.locationTags.join("、")}` : "",
      salary ? `薪资 ${formatConfigValue("salaryFilter", config.salaryFilter)}` : "",
      count("blockedCompanies") ? `排除公司 ${count("blockedCompanies")} 家` : "",
      group("详情 ", [["detailOptionalTags", "包含"], ["detailRequiredTags", "必须"], ["detailBlockedTags", "排除"]]),
      count("recruiterIncludeTags") || activity ? "招聘者有限制" : "",
    ].filter(Boolean);
    if (!summary.length) return "筛选条件：未设置，列表里的岗位都会尝试沟通";
    const details = Object.keys(CONFIG_FIELD_LABELS)
      .filter((key) => key !== "targetCount" && (Array.isArray(config[key]) ? count(key) && !(key === "recruiterActivityStatus" && !activity) : true))
      .filter((key) => (key === "jobTypeFilter" ? jobTypeFilterActive() : key === "salaryFilter" ? salary : true))
      .map((key) => `${CONFIG_FIELD_LABELS[key]}：${formatConfigValue(key, config[key])}`);
    return `筛选条件：${summary.join(" · ")}\n${details.join("\n")}`;
  }

  // 列表里没有可投的岗位时，说清楚是投完了还是规则没匹配上。
  function listExhaustedMessage(total, fresh, contacted, rejected) {
    if (!total) return "当前列表没有岗位，本次结束";
    if (!fresh) return `当前列表的 ${total} 个岗位都已处理完，本次结束。可以换城市或搜索词继续`;
    const reasons = Object.entries(rejected).sort((a, b) => b[1] - a[1]);
    const top = reasons.slice(0, 4).map(([label, n]) => `${label} ${n}`).join("、");
    const ruled = fresh - contacted;
    if (!ruled) return `列表已到底，剩下的 ${fresh} 个岗位都已沟通过，本次结束。可以换城市或搜索词继续`;
    return `列表已到底，剩下的 ${ruled} 个新岗位都不符合筛选规则（${top}${reasons.length > 4 ? " 等" : ""}），本次结束。`
      + "可以在「筛选设置」顶部的预览里看哪条规则挡得最多，或换城市、搜索词继续";
  }

  const Core = {
    async startProcessing(run) {
      let roundIndex = 0;

      while (Delivery.isCurrent(run)) {
        if (state.delivery.dailyCount >= state.targetCount) {
          this.log(`已达到今日投递目标 ${state.targetCount} 次，自动停止`);
          stopProcess(run);
          return;
        }
        if (state.delivery.dailyCount >= CONFIG.DAILY_LIMIT) {
          this.log(`今日已投递 ${state.delivery.dailyCount} 次，已达每日上限 ${CONFIG.DAILY_LIMIT}，自动停止`);
          stopProcess(run);
          return;
        }

        const remaining = Math.max(state.targetCount - state.delivery.dailyCount, 0);
        const roundSize = roundIndex === 0
          ? Math.min(remaining, 150)
          : Math.max(Math.min(remaining, 150 - roundIndex * 30), 30);

        RunStatus.setActivity("正在加载岗位列表…");
        await this.autoScrollJobList(roundSize, run);
        if (!Delivery.isCurrent(run)) return;

        state.jobList = [];
        state.currentIndex = 0;

        while (Delivery.isCurrent(run)) {
          if (state.delivery.dailyCount >= state.targetCount || state.delivery.dailyCount >= CONFIG.DAILY_LIMIT) break;
          await this.processJobList(run);
          if (!Delivery.isCurrent(run)) break;
          if (state.currentIndex >= state.jobList.length && state.jobList.length > 0) break;
          await this.delay(CONFIG.BASIC_INTERVAL);
        }

        if (!Delivery.isCurrent(run)) break;
        if (state.delivery.dailyCount >= state.targetCount || state.delivery.dailyCount >= CONFIG.DAILY_LIMIT) {
          this.log(state.delivery.dailyCount >= state.targetCount
            ? `已达到今日投递目标 ${state.targetCount} 次，自动停止`
            : `今日已投递 ${state.delivery.dailyCount} 次，已达每日上限 ${CONFIG.DAILY_LIMIT}，自动停止`);
          break;
        }

        state.jobIndexOffset += state.jobList.length;
        roundIndex++;
        this.log(`正在收集第 ${roundIndex + 1} 轮岗位...`);
      }

      if (Delivery.isCurrent(run)) stopProcess(run);
    },

    async autoScrollJobList(roundSize, run) {
      return new Promise((resolve) => {
        const cardSelector = BOSS.jobCard;
        const maxHistory = 5;
        const baseWait = CONFIG.BASIC_INTERVAL + 500;
        let cardCountHistory = [];
        let adaptiveDelay = baseWait;
        let noChangeStreak = 0;

        const maxNeeded = Math.min(roundSize, Math.max(CONFIG.DAILY_LIMIT - state.delivery.dailyCount, 0));
        if (maxNeeded <= 0) {
          resolve({ hitBottom: false });
          return;
        }

        const countFiltered = () => {
          const contacted = ContactedJobs.setFor(run.uid);
          return Array.from(document.querySelectorAll(cardSelector)).filter((card) =>
            !isHandled(card, run) && !coarseRejectReason(readCardInfo(card), contacted)).length;
        };

        const scrollStep = async () => {
          if (!Delivery.isCurrent(run)) { resolve({ hitBottom: false }); return; }

          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
          });
          await this.delay(adaptiveDelay);
          if (!Delivery.isCurrent(run)) { resolve({ hitBottom: false }); return; }

          const cards = document.querySelectorAll(cardSelector);
          const currentCount = cards.length;
          cardCountHistory.push(currentCount);
          if (cardCountHistory.length > maxHistory) cardCountHistory.shift();

          // 自适应延迟：连续 2 次无变化才减半，最低 800ms，有新卡片时重置
          if (cardCountHistory.length >= 2 && cardCountHistory[cardCountHistory.length - 1] !== cardCountHistory[cardCountHistory.length - 2]) {
            adaptiveDelay = baseWait;
            noChangeStreak = 0;
          } else if (cardCountHistory.length >= 3 && cardCountHistory[cardCountHistory.length - 1] === cardCountHistory[cardCountHistory.length - 2]) {
            noChangeStreak++;
            if (noChangeStreak >= 2) {
              adaptiveDelay = Math.max(Math.floor(adaptiveDelay / 2), 800);
            }
          }

          const filtered = countFiltered();
          if (filtered >= maxNeeded) {
            resolve({ hitBottom: false });
            return;
          }

          if (
            cardCountHistory.length === maxHistory &&
            new Set(cardCountHistory).size === 1
          ) {
            this.log("当前页面岗位加载完成，开始沟通");
            resolve({ hitBottom: true });
            return;
          }

          scrollStep();
        };

        scrollStep();
      });
    },

    async processJobList(run) {
      if (!Delivery.isCurrent(run)) return;
      const activeStatusFilter = state.settings.recruiterActivityStatus;
      // 粗筛：只看列表卡片上的信息
      if (!state.jobList || state.jobList.length === 0) {
        const contacted = ContactedJobs.setFor(run.uid);
        const cards = document.querySelectorAll(BOSS.jobCard);
        let skippedContacted = 0;
        let fresh = 0;
        const rejected = {};
        // 粗筛没通过的只在本次投递、同一套规则下不再重复统计；投递中改了规则会重新判断
        const coarseMark = `${run.id}:${rulesKey()}`;
        state.jobList = [];
        cards.forEach((card) => {
          if (isHandled(card, run) || card.dataset.zdlCoarse === coarseMark) return;
          fresh++;
          const info = readCardInfo(card);
          const { reason, label } = coarseExplain(info, contacted);
          if (reason === "contacted") {
            skippedContacted++;
            card.dataset.zdlProcessed = run.mark;
          } else if (reason) {
            rejected[label] = (rejected[label] || 0) + 1;
            card.dataset.zdlCoarse = coarseMark;
          }
          if (reason) return;
          state.jobList.push({
            el: card, jobId: info.jobId, company: info.company, logo: info.logo,
            job: info.title, salary: info.salary, address: info.address, tags: info.tags,
          });
        });

        const contactedNote = skippedContacted ? `，跳过已沟通过的 ${skippedContacted} 个` : "";
        const scope = fresh === cards.length ? `共 ${cards.length} 个岗位` : `新加载 ${fresh} 个岗位（列表共 ${cards.length} 个）`;
        this.log(`筛选完成，${scope}，匹配 ${state.jobList.length} 个${contactedNote}`);
        if (!state.jobList.length) {
          this.log(listExhaustedMessage(cards.length, fresh, skippedContacted, rejected));
          stopProcess(run);
          return;
        }
      }

      if (state.currentIndex >= state.jobList.length) {
        // jobList 已耗尽，返回让外层循环决定是否开始下一轮
        return;
      }

      // 细筛：打开详情后判断
      const item = state.jobList[state.currentIndex];
      const cardEl = item.el;
      const cumulativeTotal = state.jobIndexOffset + state.jobList.length;
      const idx = state.jobIndexOffset + state.currentIndex + 1;
      const prefix = `第${idx}/${cumulativeTotal}个，[${item.address}][${item.company}][${item.job}][${item.salary}]`;
      const skip = (message, key = message) => {
        this.log(`${prefix}，${message}，已跳过`);
        run.skips[key] = (run.skips[key] || 0) + 1;
        state.currentIndex++;
        RunStatus.render();
      };
      highlightCard(cardEl);
      RunStatus.setActivity(`正在看：${item.company} · ${item.job}`);
      const detailReady = await this.openDetail(item, run);
      // 中途停止时不打标记，下次开始会重新处理这个岗位
      if (!Delivery.isCurrent(run)) return;
      if (!detailReady) {
        // 加载超时的岗位本次不再试，下次开始时重试
        cardEl.dataset.zdlTimeout = run.id;
        skip("详情加载超时");
        this.stopIfBroken(run, "detail");
        return;
      }
      run.guard.ok("detail");
      cardEl.dataset.zdlProcessed = run.mark;

      let activeTime = "未知";
      const onlineTag = findInDetail(BOSS.recruiterOnline);
      if (onlineTag && onlineTag.textContent.trim() === "在线") {
        activeTime = "在线";
      } else {
        activeTime = findInDetail(BOSS.recruiterActive)?.textContent?.trim() || "未知";
      }
      if (activeStatusFilter.length > 0 && !activeStatusFilter.includes(activeTime)) {
        return skip(`招聘者"${activeTime}"`, "招聘者活跃状态不符");
      }

      let matchReason = "";

      // 岗位类型与经验：加上职位描述后给出最终判断
      if (jobTypeFilterActive()) {
        const root = getDetailRoot();
        const detailTags = root === document ? []
          // 经验、学历在详情头部的 .tag-list 里；.job-label-list 是技能标签，不参与类型判断
          : Array.from(root.querySelectorAll(BOSS.detailTags), (li) => li.textContent.trim());
        const jobType = classifyJob({
          title: item.job,
          tags: [...(item.tags || []), ...detailTags],
          desc: cleanDesc(document.querySelector(BOSS.detailDesc)),
          salary: item.salary,
        });
        if (!jobTypeAccepted(jobType)) {
          return skip(`岗位类型"${jobType.label}"不在投递范围${jobType.evidence ? `（${jobType.evidence}）` : ""}`, `岗位类型"${jobType.label}"`);
        }
        matchReason = `类型"${jobType.label}"`;
      }
      if (state.detailBlockedTags.length || state.detailRequiredTags.length || state.detailOptionalTags.length) {
        // 判断用小写文本，日志片段从原文截取（关键词正则不区分大小写，命中位置一致）
        const descRaw = cleanDesc(document.querySelector(BOSS.detailDesc));
        const descText = descRaw.toLowerCase();
        const quote = (text, kw) => {
          const snippet = keywordSnippet(text, kw);
          return snippet ? `（${snippet}）` : "";
        };

        // 排除词：只匹配职位描述
        const hitBlocked = state.detailBlockedTags.find((kw) => matchKeyword(descText, kw));
        if (hitBlocked) return skip(`命中排除词"${hitBlocked}"${quote(descRaw, hitBlocked)}`, `详情排除"${hitBlocked}"`);

        // 必须/任一：匹配职位描述、职位标签和职位名，只在详情区域内取，避免左侧列表干扰
        if (state.detailRequiredTags.length || state.detailOptionalTags.length) {
          const root = getDetailRoot();
          const join = (selector) => Array.from(root.querySelectorAll(selector))
            .map((li) => li.textContent.trim()).join(" ");
          const jobName = findInDetail(BOSS.detailTitle)?.textContent?.trim() || "";
          const wideRaw = [descRaw, join(BOSS.detailSkillTags), jobName, join(BOSS.detailTags)].filter(Boolean).join(" ");
          const wideText = wideRaw.toLowerCase();

          const missedRequired = state.detailRequiredTags.find((kw) => !matchKeyword(wideText, kw));
          if (missedRequired) return skip(`缺少必须词"${missedRequired}"`, `缺少"${missedRequired}"`);
          if (state.detailRequiredTags.length) matchReason = `必须"${state.detailRequiredTags.join("、")}"`;

          if (state.detailOptionalTags.length) {
            const matchedOptional = state.detailOptionalTags.filter((kw) => matchKeyword(wideText, kw));
            if (!matchedOptional.length) return skip("详情没有命中任一关键词");
            matchReason = (matchReason ? matchReason + "；" : "") + `任一"${matchedOptional.join("、")}"${quote(wideRaw, matchedOptional[0])}`;
          }
        }

      }

      // 只投指定招聘者：读不到招聘者职位时不拦截，避免页面结构变化导致全部被跳过
      if (state.recruiterIncludeTags.length) {
        const bossRaw = (findInDetail(BOSS.recruiterTitle)?.textContent || "").replace(/\s+/g, " ").trim();
        if (bossRaw) {
          const hitRecruiter = state.recruiterIncludeTags.find((kw) => matchKeyword(bossRaw.toLowerCase(), kw));
          if (!hitRecruiter) return skip(`招聘者"${bossRaw}"不在只投范围`, "招聘者职位不符");
          matchReason = (matchReason ? matchReason + "；" : "") + `招聘者"${bossRaw}"`;
        } else {
          matchReason = (matchReason ? matchReason + "；" : "") + "未读到招聘者职位，未做招聘者筛选";
        }
      }

      const chatBtn = findInDetail(BOSS.chatButton);
      const btnText = chatBtn?.textContent.trim() || "";
      if (btnText !== BOSS.chatButtonNew) {
        if (btnText === BOSS.chatButtonContacted) {
          run.guard.ok("chat");
          ContactedJobs.add(run.uid, item.jobId);
          return skip("之前已沟通过", "已沟通过");
        }
        skip("没有沟通按钮");
        this.stopIfBroken(run, "chat");
        return;
      }
      run.guard.ok("chat");

      state.currentIndex++;
      if (!Delivery.isCurrent(run)) return;
      if (state.delivery.dailyCount >= state.targetCount || state.delivery.dailyCount >= CONFIG.DAILY_LIMIT) {
        this.log(`${prefix}，已达今日目标 ${state.targetCount} 次，自动停止`);
        stopProcess(run);
        return;
      }
      chatBtn.click();

      // 检测 BOSS 限制弹窗（120 提醒 / 150 上限）
      const isLimitReached = await this.handleLimitDialogs(run);
      if (!Delivery.isCurrent(run, true)) return;
      if (isLimitReached) {
        this.log(`${prefix}，BOSS限制：今日沟通已达150次上限，自动停止`);
        stopProcess(run);
        return;
      }

      const confirmed = await this.handleGreetingModal(item.company, item.logo, item.job, run);
      if (confirmed) {
        run.guard.ok("confirm");
        ContactedJobs.add(run.uid, item.jobId);
        run.delivered++;
        RunStatus.render();
        this.log(`${prefix}，已投递${matchReason ? `，匹配 ${matchReason}` : ""}`);
      } else if (Delivery.isCurrent(run, true)) {
        this.log(`${prefix}，未确认投递成功，未增加次数`);
        this.stopIfBroken(run, "confirm");
      }
    },

    // 开始投递前检查职位列表能不能读出来，读不出关键信息时不启动。
    checkPageBeforeStart() {
      const cards = Array.from(document.querySelectorAll(BOSS.jobCard)).slice(0, 15);
      const { errors, warnings } = checkJobCards(cards.map(readCardInfo));
      warnings.forEach((warning) => this.log(`页面检查：${warning}`));
      if (!errors.length) return true;
      errors.forEach((error) => this.log(`页面检查异常：${error}`));
      showNotification("页面检查未通过，未开始投递，详见日志", "error");
      return false;
    },

    // 同一步连续失败到上限时停止投递，返回是否已停止。
    stopIfBroken(run, step) {
      if (!run.guard.fail(step) || !Delivery.isCurrent(run)) return false;
      run.failed = true;
      this.log(streakStopMessage(step));
      showNotification("投递已自动停止，详见日志", "error");
      stopProcess(run);
      return true;
    },

    // 一次投递任务结束后汇总结果，方便看出哪条规则过严。
    logRunSummary(run) {
      const skips = Object.entries(run.skips).sort((a, b) => b[1] - a[1]);
      const skipped = skips.reduce((sum, [, n]) => sum + n, 0);
      if (!run.delivered && !skipped) return;
      const top = skips.slice(0, 6).map(([key, n]) => `${key} ${n}`).join("、");
      const more = skips.length > 6 ? " 等" : "";
      this.log(`本次共投递 ${run.delivered} 个，详情页跳过 ${skipped} 个${top ? `（${top}${more}）` : ""}`);
    },

    // 点开岗位并等右侧详情切换到这个岗位，避免用上一个岗位的详情做筛选。
    // 判断依据：详情标题与卡片职位名一致，且标题或正文已变化（本来就显示该岗位时除外）。
    async openDetail(item, run) {
      const normalize = (text) => (text || "").replace(/\s+/g, "").toLowerCase();
      const wanted = normalize(item.job);
      const readDesc = () => cleanDesc(document.querySelector(BOSS.detailDesc));
      const detailTitle = () => [...document.querySelectorAll(BOSS.detailTitle)]
        .find((el) => !el.closest(`${BOSS.jobCard}, #boss-pro-panel`));
      const titleMatches = (el) => {
        const title = normalize(el?.textContent);
        return !!title && !!wanted && (title.includes(wanted) || wanted.includes(title));
      };
      const previousDesc = readDesc();
      const previousTitle = normalize(detailTitle()?.textContent);
      const alreadyShown = titleMatches(detailTitle());
      const startedAt = Date.now();

      item.el.scrollIntoView({ behavior: "smooth", block: "center" });
      item.el.click();

      const ready = await this.waitFor(() => {
        if (state.activeRun !== run || !state.isRunning) return true;
        const desc = readDesc();
        if (!desc) return false;
        const title = detailTitle();
        if (title && !titleMatches(title)) return false;
        const titleChanged = !!title && normalize(title.textContent) !== previousTitle;
        return alreadyShown || titleChanged || desc !== previousDesc;
      }, CONFIG.DETAIL_TIMEOUT, 200);

      // 保留最短操作间隔，不因页面加载快而点得过快。
      const rest = CONFIG.OPERATION_INTERVAL - (Date.now() - startedAt);
      if (rest > 0) await this.delay(rest);
      return !!ready;
    },

    async handleLimitDialogs(run) {
      // 阻塞等待上限弹窗出现（120 提醒 / 150 上限），超时 2 秒自动返回
      const dialog = await this.waitFor(() => document.querySelector(BOSS.limitDialog), 2000, 400);
      if (!Delivery.isCurrent(run, true)) return false;
      if (!dialog) return false;

      const bodyText = dialog.querySelector(BOSS.limitDialogBody)?.textContent || "";
      const is150Limit = BOSS.limitReachedTexts.some((text) => bodyText.includes(text));
      const sureBtn = dialog.querySelector(BOSS.dialogConfirm);
      if (sureBtn) sureBtn.click();

      // 可能还有第二层弹窗
      await this.delay(400);
      if (!Delivery.isCurrent(run, true)) return is150Limit;
      const second = document.querySelector(BOSS.limitDialog);
      if (second) {
        const btn2 = second.querySelector(BOSS.dialogConfirm);
        if (btn2) btn2.click();
      }
      return is150Limit;
    },

    async handleGreetingModal(companyName, companyLogo, jobTitle, run) {
      // 阻塞等待"留在此页"按钮出现（无渐入动画，直接等 DOM 就绪，超时 5 秒）
      let btn = await this.waitFor(() =>
        [...document.querySelectorAll(BOSS.dialogCancel)]
          .find((b) => b.textContent.trim() === BOSS.stayOnPageText),
        5000, 300
      );
      if (!btn || !Delivery.isCurrent(run, true)) return false;

      // 按钮出现即确认投递成功，立即更新计数（同步，保证外层限流判断正确）
      const today = new Date().toLocaleDateString();
      if (!Delivery.recordSuccess(run)) return false;

      // 异步写入日志、投递历史、公司图标（不阻塞后续岗位处理）
      const _companyName = companyName, _companyLogo = companyLogo;
      setTimeout(() => {
        // 更新公司投递历史
        if (_companyName) {
          if (!state.deliveryHistory[today]) state.deliveryHistory[today] = {};
          const entry = state.deliveryHistory[today][_companyName];
          const record = entry && typeof entry === "object" ? entry
            : { count: typeof entry === "number" ? entry : 0, logo: "" };
          record.count = (record.count || 0) + 1;
          if (_companyLogo && !record.logo) record.logo = _companyLogo;
          // 记下投了这家公司的哪些岗位（同名岗位只记一次）
          if (jobTitle) record.jobs = [...new Set([...(record.jobs || []), jobTitle])].slice(-20);
          state.deliveryHistory[today][_companyName] = record;
          try { localStorage.setItem("zdlDeliveryHistory", JSON.stringify(state.deliveryHistory)); } catch (e) {}
          if (_companyLogo && !state.companyLogos[_companyName]) {
            state.companyLogos[_companyName] = _companyLogo;
            try { localStorage.setItem("zdlCompanyLogos", JSON.stringify(state.companyLogos)); } catch (e) {}
          }
        }
      }, 0);

      // 重试点击：等 200ms 稳定后点击，若按钮仍在则重试（最多 3 次）
      for (let attempt = 0; attempt < 3 && btn; attempt++) {
        await this.delay(attempt === 0 ? 200 : 300);
        if (!Delivery.isCurrent(run, true)) break;
        btn.click();
        await this.delay(300);
        btn = [...document.querySelectorAll(BOSS.dialogCancel)]
          .find((b) => b.textContent.trim() === BOSS.stayOnPageText);
      }
      return true;
    },

    async delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    // 阻塞等待：每隔 intervalMs 执行 predicate()，一旦返回真值立即 resolve
    // 超时返回 null。不会卡死 UI（基于 Promise + setTimeout）
    async waitFor(predicate, timeoutMs, intervalMs = 300) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const result = predicate();
        if (result) return result;
        await this.delay(intervalMs);
      }
      return null;
    },

    // 日志按结构渲染：岗位行拆成“职位名 + 公司/薪资 + 原因 + 状态标签”，其余为普通提示行
    renderLogItem(logEntry) {
      const item = document.createElement("div");
      item.className = "zdl-log-item";
      const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const rich = (text) => escape(text).replace(/「([^」]{1,60})」/g, '<mark class="zdl-log-hit">$1</mark>');
      const head = logEntry.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
      const time = head ? head[1] : "";
      const message = head ? head[2] : logEntry;
      const timeEl = document.createElement("span");
      timeEl.className = "zdl-log-time";
      timeEl.textContent = time.replace(/^(\d{1,2}:\d{2}):\d{2}$/, "$1");
      timeEl.title = time;

      const job = message.match(/^第(\d+)\/(\d+)个，\[(.*?)\]\[(.*?)\]\[(.*?)\]\[(.*?)\]，([\s\S]*)$/);
      if (job) {
        const [, index, total, address, company, title, salary, rest] = job;
        const status = /已投递/.test(rest) ? "ok" : /已跳过/.test(rest) ? "skip" : "info";
        const reason = rest.replace(/，?已跳过$/, "").replace(/^已投递(?:，匹配\s*)?/, status === "ok" ? "匹配 " : "");
        item.classList.add("zdl-log-job", status);
        item.title = `第 ${index}/${total} 个`;
        const body = document.createElement("div");
        body.className = "zdl-log-body";
        const line = document.createElement("div");
        line.className = "zdl-log-line";
        const name = document.createElement("strong");
        name.textContent = title;
        const meta = document.createElement("span");
        meta.className = "zdl-log-meta";
        meta.textContent = [company, salary, address].filter(Boolean).join(" · ");
        line.append(name, meta);
        body.appendChild(line);
        if (reason && reason !== "匹配 ") {
          const desc = document.createElement("div");
          desc.className = "zdl-log-desc";
          desc.innerHTML = rich(reason);
          body.appendChild(desc);
        }
        const badge = document.createElement("span");
        badge.className = `zdl-log-badge ${status}`;
        badge.textContent = status === "ok" ? "已投递" : status === "skip" ? "跳过" : "提示";
        item.append(timeEl, body, badge);
        return item;
      }

      const text = document.createElement("div");
      text.className = "zdl-log-text";
      // 多行消息：第一行直接显示，其余折叠
      const [first, ...rest] = message.split("\n");
      text.innerHTML = rich(first);
      if (rest.length) {
        const more = document.createElement("details");
        more.className = "zdl-log-more";
        const label = document.createElement("summary");
        label.textContent = "查看完整规则";
        const body = document.createElement("div");
        body.innerHTML = rest.map(rich).join("<br>");
        more.append(label, body);
        text.appendChild(more);
      }
      item.append(timeEl, text);
      if (/本次共投递|本次结束|自动停止|投递已停止|已离开职位页/.test(message)) item.classList.add("zdl-log-key");
      if (/投递已停止|失败|异常/.test(message)) item.classList.add("zdl-log-error");
      if (/^提示：/.test(message)) item.classList.add("zdl-log-tip");
      return item;
    },

    log(message) {
      const logEntry = `[${new Date().toLocaleTimeString()}] ${message}`;
      state.logEntries.push(logEntry);
      saveLogEntries();
      const logPanel = document.querySelector("#pro-log");
      if (logPanel) {
        // 用户往上翻看旧日志时不强行滚到底
        const atBottom = logPanel.scrollHeight - logPanel.scrollTop - logPanel.clientHeight < 40;
        logPanel.appendChild(this.renderLogItem(logEntry));
        if (atBottom) logPanel.scrollTop = logPanel.scrollHeight;
        UI._refreshLogTabs();
      }
    },

  };

  function stopProcess(run = state.activeRun) {
    if (run && state.activeRun !== run) return;
    if (run) run.cancelled = true;
    state.isRunning = false;
    state.currentIndex = 0;
    Delivery.render();
  }

  async function toggleProcess() {
    if (state.activeRun) {
      if (state.isRunning) {
        state.activeRun.userStopped = true;
        Core.log("已手动停止投递");
        stopProcess(state.activeRun);
      }
      return;
    }
    Delivery.sync();
    if (!state.account.id || state.account.needsReload || state.account.error) {
      showNotification(state.account.error || (state.account.needsReload
        ? "账号已变化，请刷新页面后启动" : "未识别到账号，请确认登录后重试"), "error");
      return;
    }
    if (!isJobsPage()) {
      showNotification("请先切换到「职位」页再启动", "error");
      return;
    }
    if (!hasFilterRules()) {
      const choice = await UI._confirm({
        title: "还没有设置筛选规则",
        message: "现在开始会对列表里的所有岗位发起沟通，包括销售、客服等不相关的岗位。建议先用求职向导生成一套基础规则。",
        actions: [
          { label: "仍然开始", value: "start" },
          { label: "打开求职向导", value: "wizard", primary: true },
        ],
      });
      if (choice === "wizard") {
        UI._showSettingsPanel();
        UI._openWizard();
      }
      if (choice !== "start" || state.activeRun) return;
    }
    if (!navigator.locks?.request) {
      showNotification("当前浏览器不支持投递任务锁，请使用新版 Chrome 或 Edge", "error");
      return;
    }
    const run = {
      uid: state.account.id, id: Math.random().toString(36).slice(2), mark: "",
      started: false, cancelled: false, delivered: 0, skips: {}, guard: createStreakGuard(),
    };
    state.activeRun = run;
    Delivery.render();
    // 浏览器会给后台标签页的定时器限速，投递会明显变慢：切到后台时提醒一次
    const onVisibilityChange = () => {
      if (!document.hidden || run.warnedHidden || state.activeRun !== run || !state.isRunning) return;
      run.warnedHidden = true;
      Core.log("提示：页面在后台时浏览器会限速，投递会明显变慢，建议让这个标签页保持在前台");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    try {
      // 同一浏览器只运行一个投递任务，避免多标签重复投递及计数覆盖。
      await navigator.locks.request(DELIVERY_LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) throw new Error("本机已有其他标签页正在投递，请先停止该任务");
        Delivery.sync();
        if (run.cancelled || state.account.id !== run.uid || state.account.needsReload || state.account.error) {
          throw new Error("账号或投递记录已变化，请刷新页面后重试");
        }
        Delivery.prepare(run);
        if (state.delivery.dailyCount >= Math.min(state.targetCount, CONFIG.DAILY_LIMIT)) {
          Core.log(`当前账号今日已投递 ${state.delivery.dailyCount} 次，已达今日目标或上限`);
          return;
        }
        if (!Core.checkPageBeforeStart()) return;
        run.mark = `${run.uid}:${rulesKey()}`;
        state.jobList = [];
        state.currentIndex = 0;
        state.jobIndexOffset = 0;
        run.started = true;
        state.isRunning = true;
        Delivery.render();
        const startTime = new Date();
        Core.log(`开始自动海投，时间：${startTime.toLocaleTimeString()}`);
        Core.log(filterSummary());

        await Core.startProcessing(run);
      });
    } catch (error) {
      run.failed = true;
      Core.log(`投递已停止：${state.account.error || error.message}`);
      showNotification(state.account.error || error.message, "error");
    } finally {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      highlightCard(null);
      if (run.started) {
        Core.logRunSummary(run);
        RunStatus.finish(run.userStopped ? "已停止" : run.failed ? "投递异常" : "投递完成");
      }
      if (state.activeRun === run) {
        state.isRunning = false;
        state.activeRun = null;
        Delivery.render();
      }
    }
  }

  const CSS = `
.zdl-tutorial{position:fixed;inset:0;box-sizing:border-box;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;color:#1f2937;font-family:var(--zdl-font);overflow:hidden}
.zdl-tutorial::backdrop{background:transparent}
.zdl-tutorial-focus{position:fixed;box-sizing:border-box;border:2px solid var(--zdl-primary);border-radius:7px;box-shadow:0 0 0 9999px rgba(15,23,42,.42);pointer-events:none}
.zdl-tutorial-arrow{position:fixed;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.zdl-tutorial-line{fill:none;stroke:var(--zdl-primary);stroke-width:2.5}
.zdl-tutorial-card{position:fixed;box-sizing:border-box;width:min(280px,calc(100vw - 24px));max-height:calc(100vh - 24px);padding:14px 16px;border:1px solid #bfdbfe;border-radius:12px;background:#fff;box-shadow:0 8px 32px rgba(15,23,42,.2);overflow-y:auto}
.zdl-tutorial-header{display:flex;justify-content:space-between;align-items:center;gap:12px}
.zdl-tutorial-step{font:600 12px/1.5 ui-monospace,monospace;color:var(--zdl-primary)}
.zdl-tutorial-close{width:24px;height:24px;padding:0;border:0;border-radius:50%;background:var(--zdl-secondary);color:var(--zdl-neutral);font-size:20px;line-height:1;cursor:pointer}
.zdl-tutorial h2{margin:6px 0;font-size:16px;line-height:1.5;font-weight:600;color:#1f2937}
.zdl-tutorial-desc{margin:0;font-size:14px;line-height:1.65;color:#4b5563}
.zdl-tutorial-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:14px}
.zdl-tutorial-navigation{display:flex;gap:6px}
.zdl-tutorial-btn{padding:5px 9px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#4b5563;font-size:12px;line-height:1.5;cursor:pointer;white-space:nowrap}
.zdl-tutorial-btn.primary{background:var(--zdl-primary);border-color:var(--zdl-primary);color:#fff}
.zdl-tutorial-btn:disabled{opacity:.4;cursor:default}
.zdl-tutorial-btn:focus-visible,.zdl-tutorial-close:focus-visible{outline:2px solid var(--zdl-primary);outline-offset:2px}
.zdl-config-controls{flex-shrink:0;margin-top:12px;padding-top:12px;border-top:1px solid var(--zdl-border)}
.zdl-config-row{display:flex;align-items:center;gap:10px}
.zdl-config-buttons{display:flex;gap:6px;flex-shrink:0;margin-left:auto}
.zdl-config-controls .zdl-config-btn{min-height:28px;padding:3px 10px;border-color:transparent;background:transparent;color:var(--zdl-text-3)}
.zdl-config-controls .zdl-config-btn:not(:disabled):hover{border-color:var(--zdl-border);background:var(--zdl-secondary);color:var(--zdl-primary)}
.zdl-config-controls .zdl-config-text{margin:0 0 8px}
.zdl-config-controls>div:first-child:not([hidden]){display:flex;flex-direction:column;align-items:flex-end;margin-bottom:8px}
.zdl-config-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:5px 11px;border:1px solid var(--zdl-border);border-radius:7px;background:#fff;color:var(--zdl-text-2);font-family:inherit;font-size:12px;font-weight:500;line-height:1.5;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.zdl-config-btn:hover{border-color:#c3d4f7;background:var(--zdl-accent);color:var(--zdl-primary)}
.zdl-config-text{display:block;box-sizing:border-box;width:100%;margin:10px 0;padding:10px 12px;border:1px solid var(--zdl-border);border-radius:8px;background:var(--zdl-secondary);color:var(--zdl-ink);font:12px/1.7 ui-monospace,monospace;resize:vertical;user-select:text}
.zdl-config-status{flex:1;min-width:0;font-size:12px;line-height:1.5;color:var(--zdl-neutral);overflow-wrap:anywhere}
.zdl-config-status.error{color:#dc2626}
.zdl-config-btn[hidden]{display:none}
.zdl-config-btn:disabled{opacity:.5;cursor:default}
.zdl-config-scope{margin:8px 0 0;color:var(--zdl-neutral);font-size:11px;line-height:1.7}
.zdl-import-dialog{position:fixed;inset:0;box-sizing:border-box;width:min(480px,calc(100vw - 24px));height:fit-content;max-width:none;max-height:calc(100vh - 24px);margin:auto;padding:18px;border:1px solid var(--zdl-border);border-radius:14px;background:#fff;color:var(--zdl-ink);font-family:var(--zdl-font);box-shadow:0 18px 70px rgba(23,36,58,.2);overflow:hidden}
.zdl-import-dialog[open]{display:flex;flex-direction:column}
.zdl-import-dialog::backdrop{background:rgba(23,36,58,.3)}
.zdl-confirm-dialog{width:min(400px,calc(100vw - 24px))}
.zdl-confirm-message{margin:0;font-size:13px;line-height:1.7;color:var(--zdl-text-2)}
.zdl-import-body{min-height:0;overflow:auto}
.zdl-import-body .zdl-config-scope{margin-top:0}
.zdl-import-body .zdl-config-text{min-height:80px;max-height:32vh}
.zdl-import-feedback{margin:0 0 10px;color:var(--zdl-text-2);font-size:12px;line-height:1.7}
.zdl-import-feedback.error{color:#dc2626}
.zdl-config-diff{margin:0;font-size:12px;line-height:1.7}
.zdl-config-diff>div{padding:9px 0;border-top:1px solid var(--zdl-border)}
.zdl-config-diff dt{color:var(--zdl-ink);font-weight:500}
.zdl-config-diff dd{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin:3px 0 0;overflow-wrap:anywhere}
.zdl-config-diff dd>*{min-width:0;max-width:100%;overflow-wrap:anywhere}
.zdl-config-before{color:var(--zdl-neutral)}
.zdl-config-arrow{color:var(--zdl-text-4)}
.zdl-config-diff strong{color:var(--zdl-primary);font-weight:500}
.zdl-import-footer{display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;margin-top:14px;padding-top:14px;border-top:1px solid var(--zdl-border)}
.zdl-config-primary{border-color:var(--zdl-primary);background:var(--zdl-primary);color:#fff}
.zdl-config-primary:not(:disabled):hover{background:#255fd3;color:#fff}
.zdl-import-dialog button:focus-visible,.zdl-import-dialog textarea:focus-visible{outline:2px solid #a6c0f7;outline-offset:2px}

.zdl-delivery-controls{padding:0 0 16px;flex-shrink:0}
.zdl-delivery-target{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.zdl-settings-open{margin-left:auto;min-height:36px;color:var(--zdl-text-2);background:#fff}
.zdl-settings-panel{position:fixed;box-sizing:border-box;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 24px);padding:18px;border:1px solid var(--zdl-border);border-radius:14px;background:#fff;box-shadow:var(--zdl-shadow-lg);font-family:var(--zdl-font);z-index:2147483647;display:flex;flex-direction:column;overflow:hidden}
.zdl-settings-panel[hidden]{display:none}
.zdl-settings-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--zdl-border);flex-shrink:0}
.zdl-settings-header h4{margin:0;font-size:15px;line-height:1.5;font-weight:600;color:var(--zdl-ink)}
.zdl-settings-panel .zdl-settings-scroll{flex:1;min-height:120px;max-height:none;padding-right:3px;overflow:auto}
.zdl-panel{position:fixed;box-sizing:border-box;top:24px;right:16px;width:368px;height:540px;max-width:calc(100vw - 32px);max-height:calc(100vh - 48px);min-width:min(320px,calc(100vw - 32px));min-height:min(350px,calc(100vh - 48px));border-radius:16px;padding:18px;font-family:var(--zdl-font);z-index:2147483647;display:flex;flex-direction:column;background:#fff;box-shadow:var(--zdl-shadow-lg);border:1px solid var(--zdl-border);overflow:hidden}
.zdl-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:10px;row-gap:14px;margin-bottom:16px;flex-shrink:0}
.zdl-btn-group{display:flex;align-items:center;gap:4px;flex-shrink:0}
.zdl-title-wrap{display:flex;align-items:center;gap:9px;min-width:0}
.zdl-title-icon{width:32px;height:32px;flex:0 0 32px;padding:5px;box-sizing:border-box;background:var(--zdl-primary);border-radius:9px;display:flex;justify-content:center;align-items:center;color:#fff}
.zdl-title-text h3{margin:0;color:var(--zdl-ink);font-weight:600;font-size:16px;line-height:1.4;white-space:nowrap}
.zdl-filter-container{background:transparent;padding:0;margin:0}
.zdl-filter-label{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:12px;line-height:1.6;flex-shrink:0}
.zdl-filter-title{font-weight:500;color:var(--zdl-text-2)}
.zdl-filter-desc{color:var(--zdl-text-4);font-size:11px}
.zdl-btn-start{box-sizing:border-box;width:100%;min-height:42px;padding:10px 16px;background:var(--zdl-primary);color:#fff;border:none;border-radius:9px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;line-height:1.5;transition:background .15s,box-shadow .15s;display:flex;justify-content:center;align-items:center;box-shadow:0 3px 8px rgba(var(--zdl-primary-rgb),.15);margin:0 auto}
.zdl-btn-start:hover{background:#255fd3;box-shadow:0 4px 12px rgba(var(--zdl-primary-rgb),.22)}
.zdl-icon-btn{box-sizing:border-box;width:28px;height:28px;flex:0 0 28px;padding:5px;border-radius:7px;border:1px solid transparent;background:transparent;cursor:pointer;display:flex;justify-content:center;align-items:center;color:var(--zdl-text-3);transition:background .15s,color .15s,border-color .15s}
.zdl-icon-btn:hover{background:var(--zdl-secondary);color:var(--zdl-primary)}
.zdl-icon-btn.pinned{background:var(--zdl-accent);border-color:#dbe7ff;color:var(--zdl-primary)}
.zdl-icon-btn.svg-btn{padding:5px}
.zdl-log{flex:1;min-height:0;overflow-y:auto;background:transparent;padding:10px 12px;font-size:12px;line-height:1.8;margin:0;color:var(--zdl-text-2);user-select:text;scrollbar-width:thin;scrollbar-color:#c5d1e2 transparent}
.zdl-log::-webkit-scrollbar{width:6px}
.zdl-log::-webkit-scrollbar-track{background:var(--zdl-secondary);border-radius:4px}
.zdl-log::-webkit-scrollbar-thumb{background:#c5d1e2;border-radius:4px}
.zdl-scroll-wrap{flex:0 0 auto;overflow-y:auto;max-height:55%;min-height:60px;scrollbar-width:thin;scrollbar-color:#c5d1e2 transparent}
.zdl-scroll-wrap::-webkit-scrollbar{width:6px}
.zdl-scroll-wrap::-webkit-scrollbar-track{background:transparent;border-radius:4px}
.zdl-scroll-wrap::-webkit-scrollbar-thumb{background:#c5d1e2;border-radius:4px}
.zdl-resize-handle{position:absolute;right:4px;bottom:4px;width:12px;height:12px;cursor:nwse-resize;opacity:.55;background:linear-gradient(135deg,transparent 50%,#b4c1d4 50%,transparent 55%,#b4c1d4 55%,transparent 60%,#b4c1d4 60%);z-index:2}
.zdl-mini-icon{width:40px;height:40px;position:fixed;bottom:40px;left:40px;background:var(--zdl-primary);border-radius:50%;box-shadow:0 6px 16px rgba(var(--zdl-primary-rgb),.4);cursor:pointer;display:none;justify-content:center;align-items:center;color:#fff;z-index:2147483647;transition:transform .15s ease,box-shadow .15s ease;overflow:visible;user-select:none;padding:8px;box-sizing:border-box}
.zdl-status-tags{display:contents}
.zdl-status-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;font-family:inherit;border-radius:6px;font-size:12px;line-height:1.5;cursor:pointer;transition:background .15s,color .15s,border-color .15s;white-space:nowrap;background:#fff;color:var(--zdl-text-3);border:1px solid var(--zdl-border);user-select:none}
.zdl-status-chip:hover{background:var(--zdl-secondary)}
.zdl-status-chip.active{background:var(--zdl-accent);color:#315fba;border-color:#d4e2ff}
.zdl-status-chip.active:hover{background:#e1ebff}
.zdl-status-check{position:relative;width:12px;height:12px;flex-shrink:0;box-sizing:border-box;border:1.5px solid #b4c1d4;border-radius:3px;background:#fff;transition:background .15s,border-color .15s}
.zdl-status-chip.active .zdl-status-check{border-color:var(--zdl-primary);background:var(--zdl-primary)}
.zdl-status-chip.active .zdl-status-check::after{content:"";position:absolute;left:2.5px;top:0;width:3px;height:6px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
.zdl-notify{position:fixed;top:20px;left:50%;z-index:2147483647;box-sizing:border-box;max-width:min(420px,calc(100vw - 32px));padding:10px 16px 10px 14px;border:1px solid #e4eaf3;border-left:3px solid #16a34a;border-radius:9px;background:#fff;color:#17243a;font:13px/1.6 var(--zdl-font);box-shadow:0 10px 30px rgba(23,36,58,.16);opacity:0;transform:translate(-50%,-8px);transition:opacity .2s ease,transform .2s ease}
.zdl-notify.error{border-left-color:#dc2626}
.zdl-notify.show{opacity:1;transform:translate(-50%,0)}
.zdl-tag-section{margin-bottom:12px}
.zdl-collapse-body .zdl-tag-section+.zdl-tag-section{border-top:1px solid #edf0f5;padding-top:12px}
.zdl-tag-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.zdl-tag-list{display:contents}
.zdl-tag-add-trigger{width:24px;height:24px;border-radius:6px;border:1px dashed #c3cede;background:#fff;color:var(--zdl-text-3);cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;transition:border-color .15s,color .15s,background .15s;line-height:1;font-weight:500;vertical-align:middle}
.zdl-tag-add-trigger:hover{border-color:var(--zdl-primary);color:var(--zdl-primary);background:var(--zdl-accent)}
.zdl-tag{display:inline-flex;align-items:center;gap:5px;max-width:100%;box-sizing:border-box;padding:4px 7px;border-radius:6px;font-size:12px;line-height:1.5;cursor:pointer;transition:background .15s;white-space:normal;background:#edf3fe;color:#41638f;border:1px solid #dfe8f7}
.zdl-tag:hover{background:#e4ecfa}
.zdl-tag.blocked{background:#fff1f0;color:#ad4a4a;border:1px solid #f5dada}
.zdl-tag.blocked:hover{background:#fce5e3}
.zdl-tag.required{background:#fff7e8;color:#8a621e;border:1px solid #f1e4c8}
.zdl-tag.required:hover{background:#f9efd8}
.zdl-tag.optional{background:#edf3fe;color:#41638f;border:1px solid #dfe8f7}
.zdl-tag.optional:hover{background:#e4ecfa}
.zdl-collapse-header{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;line-height:1.6;font-weight:500;color:var(--zdl-text-2);padding:11px 12px;margin:0;border:0;user-select:none;transition:background .15s,color .15s}
.zdl-filter-container>div:first-child>.zdl-collapse-header{border-top:none;margin-top:0}
.zdl-collapse-header:hover{color:var(--zdl-primary);background:var(--zdl-secondary)}
.zdl-collapse-arrow{font-size:9px;width:10px;opacity:.65;flex-shrink:0}
.zdl-collapse-body{padding:12px;border-top:1px solid var(--zdl-border);overflow:visible}
.zdl-collapse-body.collapsed{display:none}
.zdl-tag-text{flex:1;min-width:0;overflow-wrap:anywhere}
.zdl-log-more{margin-top:2px}
.zdl-log-more>summary{cursor:pointer;color:var(--zdl-primary);font-size:11px;list-style:none;width:fit-content}
.zdl-log-more>summary::-webkit-details-marker{display:none}
.zdl-log-more>summary::after{content:" ▾"}
.zdl-log-more[open]>summary::after{content:" ▴"}
.zdl-log-more>div{margin-top:4px;padding:6px 8px;border-radius:6px;background:var(--zdl-secondary);color:var(--zdl-text-2);line-height:1.7;overflow-wrap:anywhere}
.zdl-tag-part+.zdl-tag-part::before{content:"/";margin:0 4px;opacity:.4}
.zdl-tag-name{font-weight:600}
.zdl-tag-meta{margin-left:6px;font-size:11px;opacity:.6;white-space:nowrap}
.zdl-tag-remove{width:14px;height:14px;border-radius:4px;border:none;background:transparent;color:inherit;opacity:.65;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}
.zdl-tag-remove:hover{background:rgba(23,36,58,.08);opacity:1}
.zdl-tag-input-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px;min-width:0}
.zdl-tag-hint{flex-basis:100%;margin:0;color:var(--zdl-text-4);font-size:11px;line-height:1.6}
.zdl-tag-hint.warn{color:#b45309}
.zdl-wizard [hidden]{display:none!important}
.zdl-wizard{width:min(540px,calc(100vw - 24px))}
.zdl-wizard-heading{display:flex;align-items:center;gap:10px;min-width:0}
.zdl-wizard-body{padding-right:4px}
.zdl-wizard-body>.zdl-wizard-step:first-child{border-top:0;padding-top:2px}
.zdl-settings-tools{display:flex;align-items:center;gap:6px;flex-shrink:0}
.zdl-wizard-btn{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px solid #cfdcf8;border-radius:999px;background:var(--zdl-accent);color:var(--zdl-primary);font:inherit;font-size:12px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background .15s,border-color .15s}
.zdl-wizard-btn:hover{border-color:#a9c2f5;background:#e3ecff}
.zdl-wizard-btn svg{width:14px;height:14px}
.zdl-empty-rules{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 12px;border:1px dashed #bcd0f6;border-radius:10px;background:var(--zdl-accent)}
.zdl-empty-rules[hidden]{display:none}
.zdl-empty-rules>span{flex:1;min-width:0;color:var(--zdl-text-2);font-size:12px;line-height:1.6}
.zdl-empty-rules strong{display:block;color:var(--zdl-ink);font-size:13px;font-weight:600}
.zdl-empty-rules .zdl-config-btn{flex-shrink:0}
.zdl-wizard-mark{display:flex;width:28px;height:28px;flex:0 0 28px;box-sizing:border-box;padding:6px;border-radius:8px;background:var(--zdl-primary);color:#fff}
.zdl-wizard-mark svg{width:100%;height:100%}
.zdl-wizard-title{display:flex;flex-direction:column;min-width:0;line-height:1.45}
.zdl-wizard-title strong{font-size:13px;font-weight:600}
.zdl-wizard-title small{color:var(--zdl-text-3);font-size:11px}
.zdl-wizard-step{padding:10px 0;border-top:1px solid #e9eef7}
.zdl-wizard-step-label{display:flex;align-items:baseline;gap:6px;margin-bottom:7px;color:var(--zdl-ink);font-size:12px;font-weight:500}
.zdl-wizard-step-label small{color:var(--zdl-text-4);font-size:11px;font-weight:400}
.zdl-wizard-index{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:0 0 16px;border-radius:50%;background:var(--zdl-accent);color:var(--zdl-primary);font-size:10px;font-weight:600;align-self:center}
.zdl-wizard-chips{display:flex;flex-wrap:wrap;gap:6px}
.zdl-wizard-inline{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;color:var(--zdl-text-2);font-size:12px}
.zdl-wizard-select,.zdl-wizard-number{box-sizing:border-box;height:28px;padding:2px 6px;border:1px solid var(--zdl-border);border-radius:6px;background:#fff;color:var(--zdl-ink);font:inherit;font-size:12px}
.zdl-wizard-number{width:64px;text-align:center}
.zdl-wizard-check{display:flex;align-items:center;gap:6px;margin-top:7px;color:var(--zdl-text-2);font-size:12px;cursor:pointer}
.zdl-wizard-check input{width:14px;height:14px;margin:0;accent-color:var(--zdl-primary);cursor:pointer}
.zdl-wizard-extras{display:grid;grid-template-columns:1fr 1fr;column-gap:10px}
.zdl-wizard-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-top:10px;border-top:1px solid #e9eef7}
.zdl-wizard-hint{margin-right:auto;color:var(--zdl-text-4);font-size:11px;line-height:1.5}
.zdl-wizard-review{margin-top:10px;padding:10px 12px;border:1px solid var(--zdl-border);border-radius:9px;background:#fff}
.zdl-wizard-review-title{margin:0 0 6px;color:var(--zdl-text-2);font-size:12px;line-height:1.6}
.zdl-wizard-review-title.error{color:#dc2626}
.zdl-wizard-review .zdl-wizard-actions{border-top:0;padding-top:8px}
.zdl-preview{display:flex;flex-direction:column;flex-shrink:0;max-height:min(46vh,420px);overflow:hidden;margin:0 0 12px;padding:9px 11px;border:1px solid var(--zdl-border);border-radius:9px;background:var(--zdl-secondary);color:var(--zdl-text-2);font-size:12px;line-height:1.6}
.zdl-preview-head{display:flex;align-items:baseline;gap:8px}
.zdl-preview-summary{flex:1;min-width:0}
.zdl-preview-summary strong{color:var(--zdl-primary);font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
.zdl-preview-toggle{flex-shrink:0;padding:1px 7px;border:1px solid var(--zdl-border);border-radius:5px;background:#fff;color:var(--zdl-primary);font:inherit;font-size:11px;cursor:pointer}
.zdl-preview-toggle:hover{border-color:#c3d4f7}
.zdl-preview-toggle[hidden]{display:none}
.zdl-preview-types{margin:8px 0 0;color:var(--zdl-text-3);font-size:11px}
.zdl-preview-warn-btn{display:block;width:100%;margin-top:6px;padding:4px 8px;border:0;border-radius:6px;background:#fffbeb;color:#b45309;font:inherit;font-size:11px;text-align:left;cursor:pointer}
.zdl-preview-warn-btn::before{content:"!";display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-right:6px;border-radius:50%;background:#f59e0b;color:#fff;font-size:10px;font-weight:700;vertical-align:-1px}
.zdl-preview-warn-btn:hover{background:#fef3c7}
.zdl-preview-warn-list{margin-top:8px;padding:6px 8px;border-radius:6px;background:#fffbeb;color:#b45309;font-size:11px;line-height:1.6}
.zdl-preview-warn-item+.zdl-preview-warn-item{margin-top:6px}
.zdl-preview-job-link{margin:0 4px 0 0;padding:0 5px;border:0;border-radius:4px;background:#fef3c7;color:#92400e;font:inherit;font-size:11px;line-height:1.7;text-decoration:underline;text-decoration-color:rgba(146,64,14,.35);text-underline-offset:2px;cursor:pointer}
.zdl-preview-job-link:hover{background:#fde68a;text-decoration-color:currentColor}
.zdl-filter-link{margin-left:auto;color:var(--zdl-primary);font-size:11px;font-weight:400;text-decoration:none}
.zdl-filter-link:hover{text-decoration:underline}
.zdl-tag-section[hidden]{display:none}
.zdl-preview-head,.zdl-preview-warn{flex-shrink:0}
/* 明细内容多时只在预览区内部滚动，不把下方的规则区挤没 */
.zdl-preview-detail{flex:1 1 auto;min-height:0;margin-right:-8px;padding-right:8px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#c5d1e2 transparent}
.zdl-preview-detail::-webkit-scrollbar{width:6px}
.zdl-preview-detail::-webkit-scrollbar-thumb{background:#c5d1e2;border-radius:4px}
.zdl-preview-detail[hidden]{display:none}
.zdl-preview-reasons{margin:8px 0 6px;color:var(--zdl-text-3);font-size:11px;line-height:1.6}
.zdl-preview-list{border-top:1px solid var(--zdl-border);scrollbar-width:thin;scrollbar-color:#c5d1e2 transparent}
.zdl-preview-row{display:flex;align-items:baseline;gap:8px;width:100%;box-sizing:border-box;padding:5px 4px;border:0;border-bottom:1px solid #e9eef5;background:none;color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer}
.zdl-preview-row:hover{background:#fff}
.zdl-preview-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--zdl-ink)}
.zdl-preview-company{flex-shrink:1;max-width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--zdl-text-4);font-size:11px}
.zdl-preview-status{flex-shrink:0;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--zdl-text-4);font-size:11px}
.zdl-preview-status.ok{color:#16a34a;font-weight:500}
.zdl-tag-hit{flex-shrink:0;min-width:14px;padding:0 4px;box-sizing:border-box;border-radius:8px;background:rgba(255,255,255,.75);font-size:10px;line-height:1.6;text-align:center;font-variant-numeric:tabular-nums}
.zdl-tag-hit.zero{opacity:.5}
.zdl-tag.conflict{box-shadow:inset 0 0 0 1.5px #f59e0b}
.zdl-tag.conflict .zdl-tag-hit{background:#fef3c7;color:#b45309;opacity:1}
li.job-card-box.zdl-preview-flash{outline:2px solid #f59e0b;outline-offset:-2px;border-radius:12px}
.zdl-log-hit{padding:0 2px;border-radius:3px;background:#fef3c7;color:#92400e}
.zdl-panel.zdl-panel-hidden{opacity:0;transform:scale(.06);pointer-events:none}
.zdl-mini-icon:hover{transform:scale(1.08);box-shadow:0 8px 20px rgba(var(--zdl-primary-rgb),.5)}
.zdl-mini-icon:focus-visible{outline:2px solid #a6c0f7;outline-offset:3px}
.zdl-mini-icon.zdl-pop{animation:zdl-pop .28s cubic-bezier(.34,1.56,.64,1) .14s both}
.zdl-mini-icon.running::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid var(--zdl-primary);animation:zdl-ring 1.8s ease-out infinite;pointer-events:none}
@keyframes zdl-pop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
@keyframes zdl-ring{0%{opacity:.55;transform:scale(1)}100%{opacity:0;transform:scale(1.45)}}
@keyframes zdl-fade-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.zdl-settings-panel:not([hidden]),.zdl-history-panel{animation:zdl-fade-in .18s ease}
.zdl-btn-start.is-running{background:#fff;color:#c2410c;box-shadow:none;outline:1px solid #f3d3c2;outline-offset:-1px}
.zdl-btn-start.is-running:hover{background:#fff7f3}
.zdl-salary-field{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 8px 0 2px;border:1px solid var(--zdl-border);border-radius:6px;background:#fff;cursor:text;transition:border-color .15s,box-shadow .15s}
.zdl-salary-field:focus-within{border-color:#a6c0f7;box-shadow:0 0 0 2px var(--zdl-accent)}
.zdl-salary-field .zdl-salary-input{width:52px;height:30px;border:0;background:transparent;box-shadow:none;padding:0 4px;appearance:textfield;-moz-appearance:textfield}
.zdl-salary-field .zdl-salary-input::-webkit-inner-spin-button,.zdl-salary-field .zdl-salary-input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.zdl-salary-field .zdl-salary-input::placeholder{color:#b4c1d4}
.zdl-salary-summary{margin-left:auto;padding:0 8px;border-radius:10px;background:var(--zdl-accent);color:var(--zdl-primary);font-size:11px;font-weight:500;line-height:1.9;white-space:nowrap}
.zdl-salary-negotiable{height:32px;box-sizing:border-box}
.zdl-salary-summary.empty{background:transparent;color:var(--zdl-text-4);font-weight:400}
a.zdl-icon-btn{text-decoration:none}
li.job-card-box.zdl-current-card{outline:2px solid var(--zdl-primary);outline-offset:-2px;border-radius:12px}
.zdl-tag-hint code{padding:0 3px;border-radius:3px;background:var(--zdl-secondary);color:var(--zdl-text-2);font:11px ui-monospace,monospace}
.zdl-tag-input{box-sizing:border-box;min-width:0;flex:1;padding:7px 9px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;line-height:1.5;background:#fff;color:var(--zdl-ink);outline:none;transition:border-color .15s,box-shadow .15s}
.zdl-tag-input:focus{border-color:#a6c0f7;box-shadow:0 0 0 2px var(--zdl-accent)}
.zdl-tag-add-btn{padding:6px 11px;background:var(--zdl-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap}
.zdl-tag-add-btn:hover{filter:brightness(1.1)}
.zdl-tag-inline{display:contents}
.zdl-salary-input{box-sizing:border-box;height:32px;padding:4px 7px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;background:#fff;color:var(--zdl-ink);outline:none;flex-shrink:0;text-align:center}
.zdl-salary-input:focus{border-color:var(--zdl-primary)}
.zdl-tag.editing{outline:2px solid var(--zdl-primary);outline-offset:2px;border-radius:14px}
.zdl-tag.dragging{opacity:0.4}
.zdl-tag.drag-over{box-shadow:inset 0 0 0 2px var(--zdl-primary)}
.zdl-history-panel{position:fixed;box-sizing:border-box;top:24px;right:16px;width:min(360px,calc(100vw - 24px));max-height:min(500px,calc(100vh - 48px));min-height:180px;border-radius:14px;padding:18px;font-family:var(--zdl-font);z-index:2147483646;display:flex;flex-direction:column;background:#fff;box-shadow:var(--zdl-shadow-lg);border:1px solid var(--zdl-border);overflow:hidden}
.zdl-hist-header{display:flex;justify-content:space-between;align-items:center;padding:0 0 12px;border-bottom:1px solid var(--zdl-border);flex-shrink:0}
.zdl-hist-header h4{margin:0;font-size:15px;line-height:1.5;font-weight:600;color:var(--zdl-ink)}
#zdl-hist-close{display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:5px;border:0;border-radius:7px;background:transparent;color:var(--zdl-text-3);cursor:pointer;box-sizing:border-box}
#zdl-hist-close:hover{background:var(--zdl-secondary);color:var(--zdl-primary)}
.zdl-hist-empty{text-align:center;padding:40px 20px;color:var(--zdl-text-4)}
.zdl-hist-date-row{display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid var(--zdl-border);flex-shrink:0;font-size:12px;color:var(--zdl-neutral)}
.zdl-hist-select{box-sizing:border-box;min-width:0;height:32px;padding:4px 7px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;color:var(--zdl-text-2);background:#fff;cursor:pointer;outline:none;flex:1}
.zdl-hist-select:focus{border-color:var(--zdl-primary)}
.zdl-hist-search{box-sizing:border-box;min-width:0;height:32px;padding:4px 9px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;color:var(--zdl-ink);outline:none;width:42%;flex-shrink:0}
.zdl-hist-search:focus{border-color:var(--zdl-primary)}
.zdl-hist-list{flex:1;overflow-y:auto;padding:4px 0}
.zdl-hist-date{padding:6px 0 10px;color:var(--zdl-neutral);font-size:12px;border-bottom:1px solid #edf0f5}
.zdl-hist-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f3f8;transition:background .15s}
.zdl-hist-row:hover{background:#f9fafb}
.zdl-hist-company{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
.zdl-hist-logo{width:30px;height:30px;border-radius:7px;object-fit:cover;flex-shrink:0;background:var(--zdl-secondary)}
.zdl-hist-no-logo{width:30px;height:30px;border:1px solid var(--zdl-border);border-radius:7px;background:var(--zdl-accent);color:#5774a3;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;box-sizing:border-box}
.zdl-hist-names{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.4}
.zdl-hist-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1f2937}
.zdl-hist-jobs{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--zdl-text-4)}
.zdl-hist-count{flex-shrink:0;font-weight:500;color:var(--zdl-primary);font-size:12px;font-variant-numeric:tabular-nums}
.zdl-hist-action{flex-shrink:0;margin-left:8px}
.zdl-hist-block-btn{padding:3px 8px;border:1px solid #f2d5d5;border-radius:5px;font-size:11px;line-height:1.5;cursor:pointer;background:#fff;color:#ad4a4a;transition:background .15s}
.zdl-hist-block-btn:hover{background:#fef2f2}
.zdl-hist-block-btn.blocked{background:#fff1f0;border-color:#f2d5d5;color:#ad4a4a}
.zdl-panel,.zdl-settings-panel,.zdl-history-panel,.zdl-tutorial,.zdl-import-dialog,.zdl-entry,.zdl-notify{--zdl-border:#e4eaf3;--zdl-ink:#17243a;-webkit-font-smoothing:antialiased}
.zdl-entry{position:fixed;top:80px;right:24px;z-index:2147483646;box-sizing:border-box;width:min(280px,calc(100vw - 32px));padding:14px;border:1px solid #c9d9fb;border-top:3px solid var(--zdl-primary);border-radius:14px;background:#fff;box-shadow:0 16px 44px rgba(23,36,58,.2),0 2px 8px rgba(23,36,58,.06);font-family:var(--zdl-font);animation:zdl-entry-in .35s ease,zdl-entry-nudge .6s ease .9s 2}
.zdl-entry-head{display:flex;align-items:center;gap:10px}
.zdl-entry-icon{position:relative;display:flex;width:38px;height:38px;flex:0 0 38px;box-sizing:border-box;padding:7px;border-radius:11px;background:var(--zdl-primary)}
.zdl-entry-icon::after{content:"";position:absolute;inset:-4px;border-radius:14px;border:2px solid var(--zdl-primary);opacity:0;animation:zdl-entry-ring 1.6s ease-out .4s 3}
.zdl-entry-text{display:flex;flex-direction:column;flex:1;min-width:0;line-height:1.45}
.zdl-entry-text strong{font-size:14px;font-weight:600;color:var(--zdl-ink)}
.zdl-entry-text span{font-size:12px;color:var(--zdl-text-3)}
.zdl-entry-close{align-self:flex-start;width:24px;height:24px;flex:0 0 24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--zdl-text-4);font-size:18px;line-height:1;cursor:pointer}
.zdl-entry-close:hover{background:var(--zdl-secondary);color:var(--zdl-ink)}
.zdl-entry-link{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:38px;margin-top:12px;padding:8px 14px;border-radius:9px;background:var(--zdl-primary);color:#fff!important;font-size:13px;font-weight:500;text-decoration:none;box-shadow:0 3px 8px rgba(var(--zdl-primary-rgb),.22);transition:background .15s}
.zdl-entry-link:hover{background:#255fd3}
.zdl-entry-link:focus-visible,.zdl-entry-close:focus-visible{outline:2px solid #a6c0f7;outline-offset:2px}
@keyframes zdl-entry-in{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
@keyframes zdl-entry-nudge{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(3px)}}
@keyframes zdl-entry-ring{0%{opacity:.6;transform:scale(.9)}100%{opacity:0;transform:scale(1.35)}}
.zdl-collapse-title{flex-shrink:0}
.zdl-collapse-desc{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--zdl-text-4);font-size:11px;font-weight:400}
.zdl-collapse-count{margin-left:auto;flex-shrink:0;padding:0 7px;border-radius:10px;background:var(--zdl-accent);color:var(--zdl-primary);font-size:11px;font-weight:500;line-height:1.8;font-variant-numeric:tabular-nums}
.zdl-collapse-count.empty{background:transparent;color:var(--zdl-text-4);font-weight:400}
.zdl-salary-sep{flex-shrink:0;color:var(--zdl-text-4);font-size:13px}
.zdl-salary-unit{flex-shrink:0;color:var(--zdl-text-3);font-size:12px;white-space:nowrap}
.zdl-hist-row.blocked .zdl-hist-name,.zdl-hist-row.blocked .zdl-hist-count{color:var(--zdl-text-4)}
.zdl-hist-row.blocked .zdl-hist-logo,.zdl-hist-row.blocked .zdl-hist-no-logo{opacity:.45}
.zdl-title-text{min-width:0}
.zdl-account-status:empty{display:none}
.zdl-accounts-panel{width:min(380px,calc(100vw - 24px))}
.zdl-accounts-content{min-height:0;overflow:auto}
.zdl-accounts-summary{margin:0 0 12px;color:var(--zdl-text-2);font-size:12px;line-height:1.7;font-variant-numeric:tabular-nums}
.zdl-accounts-table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.7;font-variant-numeric:tabular-nums}
.zdl-accounts-table th,.zdl-accounts-table td{padding:9px 8px;border-bottom:1px solid var(--zdl-border);white-space:nowrap}
.zdl-accounts-table thead th{background:var(--zdl-secondary);color:var(--zdl-text-3);font-weight:500}
.zdl-accounts-table th:first-child{text-align:left;font-weight:500}
.zdl-accounts-table th:not(:first-child),.zdl-accounts-table td{text-align:right}
.zdl-accounts-table .zdl-current-account{background:var(--zdl-accent);color:var(--zdl-primary)}
.zdl-current-badge{display:inline-block;margin-left:6px;padding:0 4px;border-radius:4px;background:#fff;color:var(--zdl-primary);font-size:10px;vertical-align:middle}
.zdl-accounts-note{margin:12px 0 0;color:var(--zdl-neutral);font-size:11px;line-height:1.7}
.zdl-accounts-error{margin:0;color:#c05621;font-size:12px;line-height:1.7}
.zdl-btn-start:disabled{opacity:.55;cursor:default;box-shadow:none}
.zdl-target-label,.zdl-target-unit{font-size:12px;line-height:1.5;white-space:nowrap;color:var(--zdl-text-3)}
.zdl-target-input{box-sizing:border-box;width:64px;height:36px;flex:0 0 64px;padding:5px 8px;border:1px solid var(--zdl-border);border-radius:7px;background:var(--zdl-secondary);color:var(--zdl-ink);font:500 14px/1.5 ui-monospace,monospace;text-align:center;font-variant-numeric:tabular-nums}
.zdl-settings-open svg{width:14px;height:14px;flex-shrink:0}
.zdl-icon-btn svg,#zdl-hist-close svg{width:100%;height:100%;display:block}
.zdl-log-section{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--zdl-border);border-radius:10px;background:var(--zdl-secondary)}
.zdl-log-heading{display:flex;align-items:center;justify-content:space-between;padding:7px 8px 7px 12px;border-bottom:1px solid var(--zdl-border);font-size:11px;font-weight:500;line-height:1.5;color:var(--zdl-text-3);flex-shrink:0}
.zdl-log-tools{display:flex;align-items:center;gap:6px}
.zdl-log-tabs{display:flex;gap:2px;padding:2px;border-radius:7px;background:#fff;border:1px solid var(--zdl-border)}
.zdl-log-tab{padding:0 7px;border:0;border-radius:5px;background:transparent;color:var(--zdl-text-3);font:inherit;font-weight:400;line-height:1.7;cursor:pointer;white-space:nowrap}
.zdl-log-tab:hover{color:var(--zdl-primary)}
.zdl-log-tab.active{background:var(--zdl-accent);color:var(--zdl-primary);font-weight:500}
.zdl-log[data-filter="ok"] .zdl-log-item:not(.zdl-log-job.ok),.zdl-log[data-filter="skip"] .zdl-log-item:not(.zdl-log-job.skip){display:none}
.zdl-log[data-empty]::before{content:attr(data-empty);display:block;padding:16px 0;text-align:center;color:var(--zdl-text-4)}
.zdl-log-clear{padding:1px 7px;border:0;border-radius:5px;background:transparent;color:var(--zdl-text-4);font:inherit;font-weight:400;cursor:pointer}
.zdl-log-clear:hover{background:#fff;color:var(--zdl-primary)}
.zdl-filter-group{margin-bottom:10px;border:1px solid var(--zdl-border);border-radius:9px;overflow:hidden;background:#fff}
.zdl-filter-group:last-child{margin-bottom:0}
.zdl-tag-row>.zdl-filter-label{flex-basis:100%;margin-bottom:2px}
.zdl-collapse-body>.zdl-tag-section:last-child{margin-bottom:0}
.zdl-panel button:focus-visible,.zdl-settings-panel button:focus-visible,.zdl-history-panel button:focus-visible,.zdl-target-input:focus-visible,.zdl-config-text:focus-visible{outline:2px solid #a6c0f7;outline-offset:2px}
@media(max-width:380px){.zdl-panel{padding:14px}.zdl-header{column-gap:8px}.zdl-title-wrap{gap:7px}.zdl-title-icon{width:30px;height:30px;flex-basis:30px}.zdl-title-text h3{font-size:14px}.zdl-btn-group{gap:2px}.zdl-header .zdl-icon-btn{width:26px;height:26px;flex-basis:26px}.zdl-delivery-target{gap:6px}.zdl-settings-open{padding:5px 8px}.zdl-settings-panel{padding:14px}}
@media(prefers-reduced-motion:reduce){.zdl-panel *,.zdl-settings-panel *,.zdl-history-panel *{transition:none!important}.zdl-mini-icon,.zdl-mini-icon::after,.zdl-settings-panel,.zdl-history-panel,.zdl-notify{animation:none!important;transition:none!important}.zdl-entry,.zdl-entry-icon::after{animation:none}}

.zdl-title-text{display:flex;align-items:baseline;gap:6px;min-width:0}
.zdl-version{padding:0 5px;border-radius:5px;background:var(--zdl-secondary);color:var(--zdl-text-4);font:500 10px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}
.zdl-kpi{grid-column:1/-1;padding:12px 14px 13px;border:1px solid var(--zdl-border);border-radius:12px;background:linear-gradient(180deg,#fafcff 0%,#f4f7fd 100%)}
.zdl-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.zdl-kpi-label{color:var(--zdl-text-3);font-size:12px;font-weight:500;letter-spacing:.02em}
.zdl-kpi-main{display:flex;align-items:baseline;gap:6px;margin-top:4px;font-variant-numeric:tabular-nums}
.zdl-kpi-value{color:var(--zdl-ink);font-size:28px;font-weight:600;line-height:1.15;letter-spacing:-.02em}
.zdl-kpi-target{color:var(--zdl-text-3);font-size:13px}
.zdl-kpi-total{margin-left:auto;color:var(--zdl-text-3);font-size:12px}
.zdl-kpi-bar{height:6px;margin-top:10px;border-radius:999px;background:#e2e8f3;overflow:hidden}
.zdl-kpi-bar>i{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#5b8ff9,var(--zdl-primary));transition:width .5s cubic-bezier(.4,0,.2,1)}
.zdl-kpi-bar.done>i{background:linear-gradient(90deg,#34c27a,#16a34a)}
.zdl-accounts-toggle{display:inline-flex;align-items:center;gap:2px;max-width:60%;padding:2px 6px 2px 9px;border:1px solid var(--zdl-border);border-radius:999px;background:#fff;color:var(--zdl-text-2);font:inherit;font-size:11px;line-height:1.6;white-space:nowrap;cursor:pointer;transition:border-color .15s,color .15s,background .15s}
.zdl-accounts-toggle svg{width:12px;height:12px;flex-shrink:0;opacity:.6;transition:transform .15s}
.zdl-accounts-toggle:hover,.zdl-accounts-toggle[aria-expanded=true]{border-color:#c3d4f7;color:var(--zdl-primary)}
.zdl-accounts-toggle[aria-expanded=true] svg{transform:rotate(90deg)}
.zdl-accounts-label{overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.zdl-account-status{display:block;margin-top:8px;padding:5px 8px;border-radius:6px;background:#fff7ed;color:#c2410c;font-size:11px;line-height:1.6;overflow-wrap:anywhere}
.zdl-account-status:empty{display:none}
.zdl-control-btn{gap:8px;min-height:44px;font-size:14px;font-weight:600;letter-spacing:.02em;background:linear-gradient(180deg,#3b7bf5 0%,var(--zdl-primary) 100%);box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 6px 16px -6px rgba(var(--zdl-primary-rgb),.55)}
.zdl-control-btn:hover:not(:disabled){background:linear-gradient(180deg,#336fe6 0%,#255fd3 100%)}
.zdl-control-btn:active:not(:disabled){transform:translateY(1px)}
.zdl-control-btn svg{width:15px;height:15px;flex-shrink:0}
.zdl-run-status{margin-top:10px;padding:8px 10px;border-radius:8px;background:var(--zdl-secondary);border:1px solid var(--zdl-border);font-size:12px;line-height:1.6;color:var(--zdl-text-2)}
.zdl-run-status[hidden]{display:none}
.zdl-run-head{display:flex;align-items:center;gap:6px;font-weight:600;color:#1f2937}
.zdl-run-dot{width:7px;height:7px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 0 rgba(22,163,74,.5);animation:zdl-run-pulse 1.6s infinite}
@keyframes zdl-run-pulse{0%{box-shadow:0 0 0 0 rgba(22,163,74,.45)}70%{box-shadow:0 0 0 6px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}
@media (prefers-reduced-motion:reduce){.zdl-run-dot{animation:none}}
.zdl-run-activity{color:var(--zdl-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zdl-control-btn.is-running{background:#fff;color:#c2410c;box-shadow:0 0 0 1px #f3d3c2 inset}
.zdl-control-btn.is-running:hover:not(:disabled){background:#fff7f3}
.zdl-log{padding:4px 12px 8px;line-height:1.6}
.zdl-log-item{display:grid;grid-template-columns:38px minmax(0,1fr) auto;column-gap:8px;padding:7px 0;border-bottom:1px solid #e9eef5;color:var(--zdl-text-2);overflow-wrap:anywhere}
.zdl-log-item:last-child{border-bottom:0}
.zdl-log-time{padding-top:1px;color:var(--zdl-text-4);font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
.zdl-log-text{grid-column:2/-1;font-size:12px}
.zdl-log-body{min-width:0}
.zdl-log-line{display:flex;align-items:baseline;gap:6px;min-width:0}
.zdl-log-line strong{flex:0 1 auto;max-width:72%;min-width:0;overflow:hidden;color:var(--zdl-ink);font-size:12px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}
.zdl-log-meta{flex:1 1 0;min-width:0;overflow:hidden;color:var(--zdl-text-4);font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.zdl-log-desc{margin-top:1px;color:var(--zdl-text-3);font-size:11px;line-height:1.6}
.zdl-log-badge{align-self:start;padding:0 7px;border-radius:999px;font-size:10.5px;font-weight:500;line-height:1.8;white-space:nowrap}
.zdl-log-badge.ok{background:#e9f8ef;color:#15803d}
.zdl-log-badge.skip{background:#f1f4f8;color:var(--zdl-text-3)}
.zdl-log-badge.info{background:#eef4ff;color:var(--zdl-primary)}
.zdl-log-item.zdl-log-key{margin:6px 0;padding:8px 10px;border:1px solid var(--zdl-border);border-radius:8px;background:#fff}
.zdl-log-item.zdl-log-key .zdl-log-text{color:var(--zdl-ink);font-weight:500}
.zdl-log-item.zdl-log-error .zdl-log-text{color:#b91c1c}
.zdl-log-item.zdl-log-tip .zdl-log-text{color:#b45309}
.zdl-log:empty::before{content:"还没有日志，开始投递后会在这里显示每个岗位的结果";display:block;padding:24px 8px;color:var(--zdl-text-4);font-size:12px;text-align:center}
`;

  function injectCSS() {
    if (document.getElementById("zdl-styles")) return;
    const style = document.createElement("style");
    style.id = "zdl-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  async function init() {
    try {
      const today = new Date().toLocaleDateString();
      if (state.logDate !== today) {
        state.logDate = today;
        state.logEntries = [];
        localStorage.setItem("zdlLogDate", today);
        saveLogEntries();
      }
      injectCSS();
      UI.init();
      Delivery.sync();
      window.addEventListener("storage", (event) => {
        if (event.key === DELIVERY_STATS_KEY || event.key?.startsWith(CURRENT_ACCOUNT_KEY) || event.key === null) Delivery.sync();
        if (event.key === null || CONFIG_STORAGE_KEYS.includes(event.key)) markConfigExternalChanged();
        if (event.key === null || CONFIG_STORAGE_KEYS.includes(event.key) || event.key === CONFIG_UNDO_KEY) UI._updateConfigControls();
      });
      window.addEventListener("focus", () => Delivery.sync());
      setInterval(() => { if (!document.hidden) Delivery.sync(); }, 1500);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) Delivery.sync(); });
      // 恢复持久化的日志条目到 DOM
      const hasHistory = state.logEntries.length > 0;
      const logPanel = document.querySelector("#pro-log");
      if (logPanel && hasHistory) {
        state.logEntries.forEach((entry) => {
          logPanel.appendChild(Core.renderLogItem(entry));
        });
        logPanel.scrollTop = logPanel.scrollHeight;
        UI._refreshLogTabs();
      }
      if (!hasHistory) {
        Core.log('欢迎使用海投助手，设置好筛选条件后点击"开始投递"');
      }
      try {
        UI.showTutorialIfNeeded();
      } catch (error) {
        console.warn("新手教程初始化失败:", error);
      }
    } catch (error) {
      console.error("初始化失败:", error);
      showNotification("初始化失败", "error");
    }
  }

  // 非职位页只显示一个入口卡片，引导首次安装的用户找到脚本。
  const ENTRY_DISMISSED_KEY = "zdlEntryDismissed";
  const EntryGuide = {
    el: null,

    show() {
      if (this.el?.isConnected) return;
      try {
        if (sessionStorage.getItem(ENTRY_DISMISSED_KEY) === "1") return;
      } catch (error) {}
      const wrap = document.createElement("div");
      wrap.className = "zdl-entry";
      wrap.setAttribute("role", "complementary");
      wrap.setAttribute("aria-label", "海投助手入口");
      const head = document.createElement("div");
      head.className = "zdl-entry-head";
      head.innerHTML = `<span class="zdl-entry-icon">${SVG_ICON}</span>
        <span class="zdl-entry-text"><strong>海投助手已就绪</strong><span>需要在「职位」页使用</span></span>`;
      const link = document.createElement("a");
      link.className = "zdl-entry-link";
      link.href = JOBS_PAGE_URL;
      link.textContent = "前往职位页开始投递 →";
      const close = document.createElement("button");
      close.type = "button";
      close.className = "zdl-entry-close";
      close.textContent = "×";
      close.title = "本次不再显示";
      close.setAttribute("aria-label", "关闭海投助手入口");
      close.addEventListener("click", () => {
        try { sessionStorage.setItem(ENTRY_DISMISSED_KEY, "1"); } catch (error) {}
        this.hide();
      });
      head.appendChild(close);
      wrap.append(head, link);
      document.body.appendChild(wrap);
      this.el = wrap;
    },

    hide() {
      this.el?.remove();
      this.el = null;
    },
  };

  let appStarted = false;

  function syncRoute() {
    if (isJobsPage()) {
      EntryGuide.hide();
      if (!appStarted) {
        appStarted = true;
        init();
      }
    } else if (!appStarted) {
      EntryGuide.show();
    }
    if (appStarted) Delivery.render();
  }

  function boot() {
    try {
      injectCSS();
      UI._applyTheme();
      syncRoute();
    } catch (error) {
      console.error("海投助手启动失败:", error);
    }
    // BOSS 站内是单页跳转，路径变化不会重新加载脚本。
    let lastPath = location.pathname;
    const onRouteChange = () => {
      if (location.pathname === lastPath) return;
      lastPath = location.pathname;
      syncRoute();
    };
    window.addEventListener("popstate", onRouteChange);
    setInterval(onRouteChange, 1000);
  }

  // 部分脚本管理器在 load 之后才注入脚本，此时直接启动。
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot, { once: true });

})();
