// ==UserScript==
// @name         zdl-BOSS海投助手
// @namespace    https://github.com/yangshengzhou03
// @version      1.0.0.0
// @description  求职工具！Yangshengzhou开发用于提高BOSS直聘投递效率，批量沟通，高效求职。安装后打开 BOSS 直聘「职位」页使用
// @author       Yangshengzhou
// @match        https://www.zhipin.com/*
// @grant        none
// @run-at       document-idle
// @supportURL   https://github.com/yangshengzhou03
// @homepageURL  https://gitee.com/yangshengzhou
// @license      AGPL-3.0-or-later
// @icon         https://www.zhipin.com/favicon.ico
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG = {
    BASIC_INTERVAL: 1000,
    OPERATION_INTERVAL: 1200,
    DAILY_LIMIT: 150,
    WORK_DAYS_PER_MONTH: 24,

    DELAYS: {
      SHORT: 30,
    },
    MAX_LOG_ENTRIES: 100,
    DETAIL_TIMEOUT: 8000,
  };

  const JOBS_PAGE_URL = "https://www.zhipin.com/web/geek/jobs?ka=header-jobs";
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

  const state = {
    isRunning: false,
    activeRun: null,
    account: { id: "", needsReload: false, error: "", writeFailed: false, pageStartedAt: Date.now(), signalId: Math.random().toString(36).slice(2), publishedUid: "" },
    currentIndex: 0,
    jobIndexOffset: 0,
    targetCount: Math.min(parseInt(localStorage.getItem("zdlTargetCount") || CONFIG.DAILY_LIMIT.toString(), 10), CONFIG.DAILY_LIMIT),

    includeTags: getStoredJSON("includeTags", []).map((t) => typeof t === "string" ? t : t.text),
    locationTags: getStoredJSON("locationTags", []),
    salaryFilter: getStoredJSON("salaryFilter", { type: "none", min: "", max: "" }),
    detailBlockedTags: getStoredJSON("detailBlockedTags", []),
    detailRequiredTags: getStoredJSON("detailRequiredTags", []),
    detailOptionalTags: getStoredJSON("detailOptionalTags", []),
    recruiterBlockedTags: getStoredJSON("recruiterBlockedTags", []),
    coarseBlockedTags: getStoredJSON("zdlCoarseBlockedTags", []),
    coarseRequiredTags: getStoredJSON("zdlCoarseRequiredTags", []),

    jobList: [],

    ui: {
      isMinimized: false,
      isPinned: getStoredJSON("panelPinned", false),
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
    recruiterBlockedTagList: null,
    detailBlockedInput: null,
    detailRequiredInput: null,
    detailOptionalInput: null,
    recruiterBlockedInput: null,
    blockedCompanyInput: null,
    blockedCompanyTagList: null,
    coarseBlockedInput: null,
    coarseBlockedTagList: null,
    coarseRequiredInput: null,
    coarseRequiredTagList: null,
    miniIcon: null,
    subtitleEl: null,
    machineStatsEl: null,
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
  };

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
      if (elements.subtitleEl) elements.subtitleEl.textContent = state.account.id
        ? `账号 ${this.maskUid(state.account.id)} · 今日 ${state.delivery.dailyCount} 次 · 累计 ${state.delivery.totalCount} 次`
        : "尚未识别到账号";
      if (elements.machineStatsEl) elements.machineStatsEl.textContent =
        `本机 · 今日 ${state.machineDelivery.dailyCount} 次 · 累计 ${state.machineDelivery.totalCount} 次`;
      if (elements.accountStatusEl) elements.accountStatusEl.textContent = state.account.error
        || (state.account.needsReload ? "账号已变化，请刷新页面后启动" : !state.account.id ? "请确认已登录 BOSS，等待账号信息加载"
          : !isJobsPage() && !state.activeRun ? "当前不是职位页，请切换到「职位」页后启动" : "");
      if (elements.controlBtn) {
        elements.controlBtn.textContent = state.activeRun
          ? (state.isRunning ? "停止" : state.activeRun.started ? "正在停止…" : "准备中…") : "启动";
        elements.controlBtn.disabled = !state.isRunning && (!!state.activeRun || !state.account.id
          || state.account.needsReload || !!state.account.error || !isJobsPage());
      }
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

  const RECRUITER_STATUS_OPTIONS = ["在线", "刚刚活跃", "今日活跃", "3日内活跃", "本周活跃", "本月活跃", "半年前活跃", "未知"];
  const collapseInstances = [];
  const TUTORIAL_SEEN_KEY = "zdlTutorialSeen";
  let tutorialShownInPage = false;
  const UI_ICONS = {
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 1.8-2.5 3.5M12 16.5h.01"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-3 4v2h10v-2l-3-4V3M12 15v6"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h5m4 0h7M4 17h7m4 0h5"/><circle cx="11" cy="7" r="2"/><circle cx="13" cy="17" r="2"/></svg>',
  };
  const SVG_ICON = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;fill:white;"><path d="M512 116.032a160 160 0 0 1 52.224 311.232v259.008c118.144-22.272 207.552-121.088 207.552-239.36 0-25.152 21.568-45.568 48.128-45.568 26.624 0 48.128 20.416 48.128 45.632 0 184.832-158.848 335.232-354.048 335.232S160 631.808 160 446.976c0-25.152 21.568-45.632 48.128-45.632 26.624 0 48.128 20.48 48.128 45.632 0 118.144 89.088 216.96 206.976 239.296V428.416A160.064 160.064 0 0 1 512 116.032z m0 96a64 64 0 1 0 0 128 64 64 0 0 0 0-128z m-36.672 668.48l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.952 19.584a56.32 56.32 0 0 1-77.504 0l-21.952-19.584a17.92 17.92 0 0 0-24.64 0l-28.288 25.6c-9.6 8.704-23.36 6.4-30.72-4.992a29.696 29.696 0 0 1 4.16-36.672l28.352-25.6a56.32 56.32 0 0 1 77.568 0l21.888 19.584a17.92 17.92 0 0 0 24.704 0l21.824-19.52a56.32 56.32 0 0 1 77.568 0l21.888 19.52a17.92 17.92 0 0 0 24.64 0l21.952-19.52a56.32 56.32 0 0 1 77.504 0l21.952 19.52a17.92 17.92 0 0 0 24.64 0l21.824-19.52a56.32 56.32 0 0 1 77.632 0l21.824 19.52c9.664 8.704 11.52 25.152 4.224 36.672-7.296 11.52-21.12 13.696-30.72 4.992l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.888 19.584a56.32 56.32 0 0 1-77.568 0l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.888 19.584a57.408 57.408 0 0 1-38.656 15.488 58.176 58.176 0 0 1-38.784-15.488z"/></svg>`;

  function minimizePanel() {
    state.ui.isMinimized = true;
    state.ui.isPinned = false;
    localStorage.setItem("panelPinned", false);
    if (elements.pinBtn) {
      elements.pinBtn.classList.remove("pinned");
      elements.pinBtn.title = "固定面板";
      elements.pinBtn.setAttribute("aria-label", "固定面板");
      elements.pinBtn.setAttribute("aria-pressed", "false");
    }
    elements.panel.style.display = "none";
    elements.miniIcon.style.display = "flex";
    UI._hideSettingsPanel();
    UI._hideAccountsPanel();
  }

  const UI = {
    init() {
      this._applyTheme();
      this.createControlPanel();
      this.createMiniIcon();

      document.addEventListener("click", (e) => {
        if (!e.isTrusted) return;
        if (document.getElementById("zdl-tutorial")?.contains(e.target)) return;
        if (elements.configDialog?.contains(e.target)) return;
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
        if (elements.configDialog.open) return;
        if (e.key === "Escape" && !document.getElementById("zdl-tutorial")
          && (!elements.settingsPanel.hidden || !elements.accountsPanel.hidden)) {
          e.preventDefault();
          e.stopPropagation();
          if (!elements.accountsPanel.hidden) this._hideAccountsPanel(true);
          else this._hideSettingsPanel(true);
        }
      }, true);
      window.addEventListener("resize", () => {
        if (!elements.settingsPanel.hidden && !document.getElementById("zdl-tutorial")) this._positionSettingsPanel();
        if (!elements.accountsPanel.hidden && !document.getElementById("zdl-tutorial")) this._positionSettingsPanel(elements.accountsPanel);
      });
    },

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
        { title: "添加职位关键词", text: "职位名「必须包含」要全部命中，「包含任一」命中一个即可。", settings: true, section: 0, target: () => sectionButton(elements.coarseRequiredInput) },
        { title: "排除不想要的岗位", text: "职位详情命中排除词，就会跳过。", settings: true, section: 1, target: () => sectionButton(elements.detailBlockedInput) },
        { title: "筛选招聘者", text: "勾选你接受的活跃状态。", settings: true, section: 2, target: () => settingsPanel.querySelector(".zdl-status-chip") },
        { title: "设置今日目标", text: "填今天累计要投多少次。", target: () => elements.targetInput },
        { title: "复制或导入配置", text: "复制配置分享给别人，对方导入后即可使用。", settings: true, target: () => settingsPanel.querySelector(".zdl-config-buttons") },
        { title: "准备好再启动", text: "点“启动”开始投递；教程不会代你点击。", target: () => elements.controlBtn },
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

    createControlPanel() {
      if (document.getElementById("boss-pro-panel")) {
        document.getElementById("boss-pro-panel").remove();
      }
      elements.settingsPanel?.remove();
      elements.accountsPanel?.remove();
      elements.configDialog?.remove();
      this._accountsSnapshot = "";
      collapseInstances.length = 0;

      elements.panel = this._createPanel();

      const header = this._createHeader();
      const controls = this._createPageControls();
      elements.log = this._createLogger();
      const logSection = document.createElement("div");
      logSection.className = "zdl-log-section";
      const logHeading = document.createElement("div");
      logHeading.className = "zdl-log-heading";
      logHeading.textContent = "投递日志";
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

    _renderConfigTags() {
      renderTagList(elements.includeTagList, state.includeTags);
      renderTagList(elements.locationTagList, state.locationTags);
      renderTagList(elements.detailBlockedTagList, state.detailBlockedTags, "blocked");
      renderTagList(elements.detailRequiredTagList, state.detailRequiredTags, "required");
      renderTagList(elements.detailOptionalTagList, state.detailOptionalTags, "optional");
      renderTagList(elements.recruiterBlockedTagList, state.recruiterBlockedTags, "blocked");
      renderTagList(elements.blockedCompanyTagList, state.blockedCompanies, "blocked");
      renderTagList(elements.coarseBlockedTagList, state.coarseBlockedTags, "blocked");
      renderTagList(elements.coarseRequiredTagList, state.coarseRequiredTags, "required");
      this._refreshFilterCounts();
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

      btnGroup.append(
        this._createIconButton(UI_ICONS.help, () => this._showTutorial(), "新手教程"),
        historyBtn,
        pinBtn,
        this._createIconButton(UI_ICONS.minus, () => minimizePanel(), "最小化海投面板")
      );
      const summary = document.createElement("div");
      summary.className = "zdl-stats-strip";
      summary.append(elements.subtitleEl);
      elements.machineStatsEl = document.createElement("span");
      elements.machineStatsEl.id = "zdl-machine-stats";
      elements.accountStatusEl = document.createElement("span");
      elements.accountStatusEl.className = "zdl-account-status";
      const machineRow = document.createElement("div");
      machineRow.className = "zdl-machine-stats-row";
      elements.accountsBtn = this._createTextButton("本机账号", () => {
        if (elements.accountsPanel.hidden) this._showAccountsPanel();
        else this._hideAccountsPanel();
      });
      elements.accountsBtn.className = "zdl-accounts-toggle";
      elements.accountsBtn.setAttribute("aria-expanded", "false");
      elements.accountsBtn.setAttribute("aria-controls", "zdl-accounts-panel");
      machineRow.append(elements.machineStatsEl, elements.accountsBtn);
      summary.append(machineRow, elements.accountStatusEl);
      header.append(title, btnGroup, summary);
      return header;
    },

    _createTitle() {
      const wrapper = document.createElement("div");
      wrapper.className = "zdl-title-wrap";
      wrapper.innerHTML = `<div class="zdl-title-icon">${SVG_ICON}</div>
        <div class="zdl-title-text">
          <h3><span style="color:var(--zdl-primary);">BOSS</span>海投助手</h3>
          <span id="zdl-subtitle"></span>
        </div>`;
      elements.subtitleEl = wrapper.querySelector("#zdl-subtitle");
      return wrapper;
    },

    _createPageControls() {
      return this._createJobListControls();
    },

    _createJobListControls() {
      const container = document.createElement("div");
      container.className = "zdl-delivery-controls";
      container.append(this._createDeliveryControls());
      return container;
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
      header.append(title, close);
      elements.settingsScroll = document.createElement("div");
      elements.settingsScroll.className = "zdl-scroll-wrap zdl-settings-scroll";
      elements.settingsScroll.append(this._createFilterContainer());
      panel.append(header, elements.settingsScroll, this._createConfigControls());
      return panel;
    },

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

    _showSettingsPanel(keepHistory = false) {
      this._hideConfigImport(false);
      this._hideAccountsPanel();
      if (!keepHistory) document.getElementById("zdl-history-panel")?.remove();
      elements.settingsPanel.hidden = false;
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
      elements.configUndoBtn = makeButton("撤销导入", () => {
        try {
          undoConfigImport();
          fallback.hidden = true;
          try {
            this._refreshConfigFilters();
            this._setConfigStatus("已恢复导入前的配置");
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

    _refreshConfigFilters() {
      const previous = elements.settingsPanel.querySelector(".zdl-filter-container");
      collapseInstances.length = 0;
      previous.replaceWith(this._createFilterContainer());
      this._renderConfigTags();
      elements.targetInput.value = state.targetCount;
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
      const recruiterResult = this._createTagSection("排除招聘者职位", state.recruiterBlockedTags, "如：工程师", "blocked", "命中即跳过");

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
      elements.recruiterBlockedInput = recruiterResult.input;
      elements.recruiterBlockedTagList = recruiterResult.tagList;
      elements.blockedCompanyInput = blockedCompanyResult.input;
      elements.blockedCompanyTagList = blockedCompanyResult.tagList;
      elements.coarseBlockedInput = coarseBlockedResult.input;
      elements.coarseBlockedTagList = coarseBlockedResult.tagList;
      elements.coarseRequiredInput = coarseRequiredResult.input;
      elements.coarseRequiredTagList = coarseRequiredResult.tagList;

      const salaryActive = () => state.salaryFilter.type !== "none" && !!(state.salaryFilter.min || state.salaryFilter.max);
      container.append(
        this._createCollapsibleSection("职位列表粗筛", "看职位名、地点、公司、薪资", [
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
        ], () => state.recruiterBlockedTags.length
          + (state.settings.recruiterActivityStatus.length < RECRUITER_STATUS_OPTIONS.length ? 1 : 0))
      );

      return container;
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
      collapseInstances.forEach((inst) => {
        if (!inst.countEl || !inst.count) return;
        const n = inst.count();
        inst.countEl.textContent = n ? `已设 ${n} 项` : "未设置";
        inst.countEl.classList.toggle("empty", !n);
      });
    },

    _createDeliveryControls() {
      const container = document.createElement("div");
      const targetRow = document.createElement("div");
      targetRow.className = "zdl-delivery-target";
      const targetLabel = document.createElement("span");
      targetLabel.className = "zdl-target-label";
      targetLabel.textContent = "今日累计目标";
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
      elements.controlBtn = this._createTextButton("启动", () => { toggleProcess(); });
      container.append(targetRow, elements.controlBtn);
      return container;
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

      inputRow.append(input, addBtn, hint);
      section.append(tagRow, inputRow);

      return { section, tagList, input };
    },

    _createSalarySection() {
      const section = document.createElement("div");
      section.className = "zdl-tag-section";

      const row = document.createElement("div");
      row.className = "zdl-tag-row";

      const label = this._createFilterLabel("薪资范围", "按月薪 K 计，日薪按 24 天折算");

      const typeSelect = document.createElement("select");
      typeSelect.className = "zdl-salary-select";
      typeSelect.innerHTML = `
        <option value="none">不限</option>
        <option value="range">范围</option>
        <option value="atLeast">至少</option>
        <option value="atMost">至多</option>
      `;
      typeSelect.value = state.salaryFilter.type;

      const minInput = document.createElement("input");
      minInput.className = "zdl-salary-input";
      minInput.type = "number";
      minInput.placeholder = "最低K";
      minInput.value = state.salaryFilter.min;
      minInput.min = "0";

      const sep = document.createElement("span");
      sep.className = "zdl-salary-sep";

      const maxInput = document.createElement("input");
      maxInput.className = "zdl-salary-input";
      maxInput.type = "number";
      maxInput.placeholder = "最高K";
      maxInput.value = state.salaryFilter.max;
      maxInput.min = "0";

      const unit = document.createElement("span");
      unit.className = "zdl-salary-unit";
      unit.textContent = "K";

      const saveSalary = () => {
        state.salaryFilter.type = typeSelect.value;
        if (typeSelect.value === "none") {
          state.salaryFilter.min = "";
          state.salaryFilter.max = "";
        } else {
          state.salaryFilter.min = minInput.value;
          state.salaryFilter.max = maxInput.value;
        }
        invalidateConfigUndo();
        localStorage.setItem("salaryFilter", JSON.stringify(state.salaryFilter));
        this._refreshFilterCounts();
      };

      const updateInputs = () => {
        if (typeSelect.value === "none") {
          minInput.style.display = "none";
          maxInput.style.display = "none";
          sep.style.display = "none";
          unit.style.display = "none";
        } else {
          sep.style.display = "";
          unit.style.display = "";
          if (typeSelect.value === "atLeast") {
            maxInput.style.display = "none";
            maxInput.value = "";
            minInput.style.display = "";
            sep.textContent = "\u2265";
            minInput.placeholder = "最低K";
          } else if (typeSelect.value === "atMost") {
            minInput.style.display = "none";
            minInput.value = "";
            maxInput.style.display = "";
            sep.textContent = "\u2264";
            maxInput.placeholder = "最高K";
          } else {
            minInput.style.display = "";
            maxInput.style.display = "";
            sep.textContent = "\uFF0D";
            minInput.placeholder = "最低K";
            maxInput.placeholder = "最高K";
          }
        }
      };

      typeSelect.addEventListener("change", () => {
        updateInputs();
        saveSalary();
      });
      minInput.addEventListener("change", saveSalary);
      maxInput.addEventListener("change", saveSalary);

      updateInputs();
      row.append(label, typeSelect, minInput, sep, maxInput, unit);
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
      // 注册在 document 上的 mousemove/mouseup 监听器在整个页面生命周期内持续存在。
      // 对于单页运行的 UserScript 而言这是可接受的，无需额外清理。
      // 筛选div、日志div、缩放手柄及其内部不可拖动
      const NO_DRAG = ".zdl-delivery-controls, .zdl-log-section, .zdl-stats-strip, .zdl-scroll-wrap, .zdl-log, .zdl-resize-handle, button, input, select, textarea, .zdl-tag, .zdl-status-chip, .zdl-collapse-header, .zdl-tag-add-trigger, .zdl-tag-remove, .zdl-salary-select, .zdl-salary-input";

      let isDragging = false;
      let startX = 0,
        startY = 0;
      let initialX = panel.offsetLeft,
        initialY = panel.offsetTop;

      panel.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (e.target.closest(NO_DRAG)) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = panel.offsetLeft;
        initialY = panel.offsetTop;
        panel.style.transition = "none";
        panel.style.zIndex = "2147483647";
      });

      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        panel.style.left = `${initialX + dx}px`;
        panel.style.top = `${initialY + dy}px`;
        panel.style.right = "auto";
      });

      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          panel.style.transition = "all 0.3s ease";
          panel.style.zIndex = "2147483646";
        }
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

      if (savedPos) {
        elements.miniIcon.style.left = savedPos.left + "px";
        elements.miniIcon.style.bottom = savedPos.bottom + "px";
      }

      elements.miniIcon.addEventListener("mouseenter", () => {
        elements.miniIcon.style.transform = "scale(1.1)";
        elements.miniIcon.style.boxShadow = "0 8px 20px rgba(var(--zdl-primary-rgb), 0.5)";
      });
      elements.miniIcon.addEventListener("mouseleave", () => {
        elements.miniIcon.style.transform = "scale(1)";
        elements.miniIcon.style.boxShadow = "0 6px 16px rgba(var(--zdl-primary-rgb), 0.4)";
      });

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
          elements.miniIcon.style.transition = "all 0.3s ease";
          elements.miniIcon.style.cursor = "";
          if (hasMoved) {
            localStorage.setItem("miniIconPos", JSON.stringify({
              left: parseInt(elements.miniIcon.style.left, 10) || 40,
              bottom: parseInt(elements.miniIcon.style.bottom, 10) || 40,
            }));
          }
          if (!hasMoved) {
            state.ui.isMinimized = false;
            elements.panel.style.display = "";
            elements.miniIcon.style.display = "none";
          }
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });

      document.body.appendChild(elements.miniIcon);
    },

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
        searchInput.placeholder = "搜索公司名";
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
          const nameSpan = document.createElement("span");
          nameSpan.className = "zdl-hist-name";
          nameSpan.textContent = e.name;
          companyDiv.appendChild(nameSpan);
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
            ? entries.filter((e) => e.name.toLowerCase().includes(keyword))
            : entries;
          if (filtered.length === 0) {
            const noResult = document.createElement("div");
            noResult.className = "zdl-hist-empty";
            noResult.textContent = keyword ? `没有匹配 "${keyword}" 的公司` : "暂无记录";
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
              if (!merged[name]) merged[name] = { count: 0, logo: dayLogo || logos[name] || "" };
              merged[name].count += count;
              if (!merged[name].logo && dayLogo) merged[name].logo = dayLogo;
            });
          });
          const entries = Object.entries(merged)
            .map(([name, obj]) => ({ name, count: obj.count, logo: obj.logo || logos[name] || "" }))
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

  function cleanDesc(descElement) {
    if (!descElement) return "";
    // 克隆节点后移除 style 标签，避免 CSS 文本混入
    const clone = descElement.cloneNode(true);
    clone.querySelectorAll("style").forEach((el) => el.remove());
    let text = clone.textContent;
    // 去除BOSS直聘反爬噪点（大小写不敏感），长模式优先
    text = text.replace(/来自\s*boss\s*直聘/gi, "");
    text = text.replace(/来自\s*boss/gi, "");
    text = text.replace(/boss\s*直聘/gi, "");
    text = text.replace(/\bboss\b/gi, "");
    text = text.replace(/直聘/g, "");
    // 去除换行、回车、制表符，压缩连续空白
    text = text.replace(/[\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    return text;
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

  // 英文按整词匹配：关键词边缘是字母时，紧挨着的字符不能也是字母（java 不匹配 javascript），
  // 中文不受影响。允许复数 s（agent 匹配 agents）；末尾加 * 表示前缀（spring* 匹配 springboot）。
  // 关键词支持正则，不是合法正则时按普通文字匹配（如 c++）。
  const LETTER_EDGE = "(?:(?<![a-z])|(?![a-z]))";
  const keywordRegexCache = new Map();

  function keywordRegex(keyword) {
    let regex = keywordRegexCache.get(keyword);
    if (regex) return regex;
    const prefix = /[a-z0-9]\*$/i.test(keyword);
    const body = prefix ? keyword.slice(0, -1) : keyword;
    const build = (source) => new RegExp(`${LETTER_EDGE}(?:${source})${prefix ? "" : `s?${LETTER_EDGE}`}`, "i");
    try {
      regex = build(body);
    } catch (error) {
      regex = build(body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
    keywordRegexCache.set(keyword, regex);
    return regex;
  }

  function matchKeyword(text, keyword) {
    return keywordRegex(keyword).test(text);
  }

  function saveTags() {
    invalidateConfigUndo();
    UI._refreshFilterCounts();
    localStorage.setItem("includeTags", JSON.stringify(state.includeTags));
    localStorage.setItem("locationTags", JSON.stringify(state.locationTags));
    localStorage.setItem("detailBlockedTags", JSON.stringify(state.detailBlockedTags));
    localStorage.setItem("detailRequiredTags", JSON.stringify(state.detailRequiredTags));
    localStorage.setItem("detailOptionalTags", JSON.stringify(state.detailOptionalTags));
    localStorage.setItem("recruiterBlockedTags", JSON.stringify(state.recruiterBlockedTags));
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
    recruiterBlockedTags: "recruiterBlockedTags",
    blockedCompanies: "zdlBlockedCompanies",
    coarseBlockedTags: "zdlCoarseBlockedTags",
    coarseRequiredTags: "zdlCoarseRequiredTags",
  };

  const CONFIG_UNDO_KEY = "zdlConfigUndoV1";
  const CONFIG_STORAGE_KEYS = [...Object.values(CONFIG_TAG_STORAGE_KEYS), "zdlTargetCount", "salaryFilter", "recruiterActivityStatus"];
  const CONFIG_FIELD_LABELS = {
    targetCount: "今日目标", salaryFilter: "薪资范围", recruiterActivityStatus: "招聘者活跃状态",
    includeTags: "职位可选词", locationTags: "工作地", detailBlockedTags: "详情禁止词",
    detailRequiredTags: "详情必须词", detailOptionalTags: "详情可选词", recruiterBlockedTags: "招聘者职位过滤",
    blockedCompanies: "不收集的公司", coarseBlockedTags: "职位禁止词", coarseRequiredTags: "职位必须词",
  };
  let configExternalChanged = false;
  let configUndoInvalidated = false;

  function getCurrentConfig() {
    const config = {
      targetCount: state.targetCount,
      salaryFilter: { type: state.salaryFilter.type, min: state.salaryFilter.min, max: state.salaryFilter.max },
      recruiterActivityStatus: [...state.settings.recruiterActivityStatus],
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
      || !validSalaryValue(salary.min) || !validSalaryValue(salary.max)) {
      throw new Error("薪资配置无效，请检查薪资类型和上下限。");
    }
    const activityOptions = RECRUITER_STATUS_OPTIONS;
    if (!Array.isArray(config.recruiterActivityStatus)
      || !config.recruiterActivityStatus.every((value) => activityOptions.includes(value))) {
      throw new Error("招聘者活跃状态配置无效。");
    }
    const normalized = {
      targetCount: config.targetCount,
      salaryFilter: { type: salary.type, min: salary.min, max: salary.max },
      recruiterActivityStatus: [...config.recruiterActivityStatus],
    };
    Object.keys(CONFIG_TAG_STORAGE_KEYS).forEach((key) => { normalized[key] = [...config[key]]; });
    return normalized;
  }

  function formatConfigValue(key, value) {
    if (key === "targetCount") return `${value} 次`;
    if (key === "salaryFilter") {
      if (value.type === "none") return "不限";
      if (value.type === "atLeast") return value.min ? `至少 ${value.min}K` : "不限";
      if (value.type === "atMost") return value.max ? `至多 ${value.max}K` : "不限";
      return `${value.min || "不限"} ~ ${value.max || "不限"}K`;
    }
    if (!value.length) return ["locationTags", "recruiterActivityStatus"].includes(key) ? "不限" : "清空";
    return value.join("、");
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

  function renderTagList(container, tags, tagType = "", editIndex) {
    container.innerHTML = "";
    tags.forEach((tag, i) => {
      const tagEl = createTagElement(tag, i, tags, container, tagType, editIndex);
      container.appendChild(tagEl);
    });
  }

  function createTagElement(text, index, tags, container, tagType = "", editIndex) {
    const el = document.createElement("span");
    el.className = "zdl-tag" + (tagType ? " " + tagType : "");
    if (editIndex === index) el.classList.add("editing");
    el.draggable = true;
    el.dataset.index = index;

    const textSpan = document.createElement("span");
    textSpan.className = "zdl-tag-text";
    textSpan.textContent = text;

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

  function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = "zdl-notify";
    notification.style.background = type === "success" ? "rgba(40, 167, 69, 0.9)" : "rgba(220, 53, 69, 0.9)";
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => (notification.style.opacity = "1"), 10);
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 2000);
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
        if (state.delivery.dailyCount >= state.targetCount || state.delivery.dailyCount >= CONFIG.DAILY_LIMIT) break;

        state.jobIndexOffset += state.jobList.length;
        roundIndex++;
        this.log(`正在收集第 ${roundIndex + 1} 轮岗位...`);
      }

      if (Delivery.isCurrent(run)) stopProcess(run);
    },

    async autoScrollJobList(roundSize, run) {
      return new Promise((resolve) => {
        const cardSelector = "li.job-card-box";
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
          const cards = document.querySelectorAll(cardSelector);
          return Array.from(cards).filter((card) => {
            if (card.dataset.zdlProcessed === run.uid) return false;
            const title = card.querySelector(".job-name")?.textContent?.toLowerCase() || "";
            const addressText = (card.querySelector(".job-address-desc")?.textContent
              || card.querySelector(".company-location")?.textContent
              || card.querySelector(".job-area")?.textContent || "").toLowerCase().trim();
            const altText = (card.querySelector(".job-tag-icon") || {}).alt || "";

            const requiredMatch = state.coarseRequiredTags.length === 0
              || state.coarseRequiredTags.every((kw) => kw && matchKeyword(title, kw));
            const optionalMatch = state.includeTags.length === 0
              || state.includeTags.some((kw) => kw && matchKeyword(title, kw));
            const locationMatch = state.locationTags.length === 0
              || state.locationTags.some((kw) => kw && matchKeyword(addressText, kw));
            const excludeHeadhunter = !altText.includes("猎头");

            let salaryMatch = true;
            const sf = state.salaryFilter;
            const needCheck = ((sf.type === "range" || sf.type === "atLeast") && sf.min)
                           || ((sf.type === "range" || sf.type === "atMost") && sf.max);
            if (needCheck) {
              const salaryEl = card.querySelector(".job-salary");
              if (salaryEl) {
                const decoded = decodeSalary(salaryEl.textContent.trim());
                const parsed = parseSalaryRange(decoded);
                if (parsed) {
                  if (sf.type === "range") {
                    const rMin = sf.min ? parseInt(sf.min) : 0;
                    const rMax = sf.max ? parseInt(sf.max) : Infinity;
                    salaryMatch = parsed.min <= rMax && rMin <= parsed.max;
                  } else if (sf.type === "atLeast") {
                    salaryMatch = !sf.min || parsed.max >= parseInt(sf.min);
                  } else if (sf.type === "atMost") {
                    salaryMatch = !sf.max || parsed.min <= parseInt(sf.max);
                  }
                }
              }
            }

            const companyBlocked = state.blockedCompanies.length > 0
              && state.blockedCompanies.some((kw) => kw && matchKeyword((card.querySelector(".boss-name")?.textContent?.trim() || "").toLowerCase(), kw));
            const coarseBlockedMatch = state.coarseBlockedTags.length > 0
              && state.coarseBlockedTags.some((kw) => kw && matchKeyword(title, kw));

            return !companyBlocked && !coarseBlockedMatch && requiredMatch && optionalMatch && locationMatch && excludeHeadhunter && salaryMatch;
          }).length;
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
      //粗筛
      if (!state.jobList || state.jobList.length === 0) {
        state.jobList = Array.from(
          document.querySelectorAll("li.job-card-box")
        ).filter((card) => card.dataset.zdlProcessed !== run.uid).filter((card) => {
          const title =
            card.querySelector(".job-name")?.textContent?.toLowerCase() || "";

          const addressRaw = (
            card.querySelector(".job-address-desc")?.textContent ||
            card.querySelector(".company-location")?.textContent ||
            card.querySelector(".job-area")?.textContent ||
            ""
          ).trim();
          card.__zdlAddress = addressRaw;
          const addressText = addressRaw.toLowerCase();
          const headhuntingElement = card.querySelector(".job-tag-icon");
          const altText = headhuntingElement ? headhuntingElement.alt : "";

          const requiredMatch =
            state.coarseRequiredTags.length === 0 ||
            state.coarseRequiredTags.every((kw) => kw && matchKeyword(title, kw));

          const optionalMatch =
            state.includeTags.length === 0 ||
            state.includeTags.some((kw) => kw && matchKeyword(title, kw));

          const locationMatch =
            state.locationTags.length === 0 ||
            state.locationTags.some(
              (kw) => kw && matchKeyword(addressText, kw)
            );

          const excludeHeadhunterMatch = !altText.includes("猎头");

          let salaryMatch = true;
          const sf = state.salaryFilter;
          const needCheck = ((sf.type === "range" || sf.type === "atLeast") && sf.min)
                         || ((sf.type === "range" || sf.type === "atMost") && sf.max);
          if (needCheck) {
            const salaryEl = card.querySelector(".job-salary");
            if (salaryEl) {
              const decoded = decodeSalary(salaryEl.textContent.trim());
              const parsed = parseSalaryRange(decoded);
              if (parsed) {
                if (sf.type === "range") {
                  const rMin = sf.min ? parseInt(sf.min) : 0;
                  const rMax = sf.max ? parseInt(sf.max) : Infinity;
                  salaryMatch = parsed.min <= rMax && rMin <= parsed.max;
                } else if (sf.type === "atLeast") {
                  salaryMatch = !sf.min || parsed.max >= parseInt(sf.min);
                } else if (sf.type === "atMost") {
                  salaryMatch = !sf.max || parsed.min <= parseInt(sf.max);
                }
              }
            }
          }

          const companyName = card.querySelector(".boss-name")?.textContent?.trim() || "";
          const companyBlocked = state.blockedCompanies.length > 0 && state.blockedCompanies.some((kw) => kw && matchKeyword(companyName.toLowerCase(), kw));
          const coarseBlockedMatch = state.coarseBlockedTags.length > 0 && state.coarseBlockedTags.some((kw) => kw && matchKeyword(title, kw));

          return !companyBlocked && !coarseBlockedMatch && requiredMatch && optionalMatch && locationMatch && excludeHeadhunterMatch && salaryMatch;
        }).map((card) => {
          return {
            el: card,
            company: card.querySelector(".boss-name")?.textContent?.trim() || "",
            logo: card.querySelector(".boss-logo img")?.src || "",
            job: card.querySelector(".job-name")?.textContent?.trim() || "",
            salary: decodeSalary(card.querySelector(".job-salary")?.textContent?.trim() || ""),
            address: card.__zdlAddress || "",
          };
        });


        const totalCards = document.querySelectorAll("li.job-card-box").length;
        this.log(`筛选完成，共 ${totalCards} 个岗位，匹配 ${state.jobList.length} 个`);
        if (!state.jobList.length) {
          this.log("没有符合条件的职位");
          stopProcess(run);
          return;
        }
      }

      if (state.currentIndex >= state.jobList.length) {
        // jobList 已耗尽，返回让外层循环决定是否开始下一轮
        return;
      }

      //细筛
      const item = state.jobList[state.currentIndex];
      const cardEl = item.el;
      const roundTotal = state.jobList.length;
      const cumulativeTotal = state.jobIndexOffset + roundTotal;
      const idx = state.jobIndexOffset + state.currentIndex + 1;
      const info = `[${item.address}][${item.company}][${item.job}][${item.salary}]`;
      cardEl.dataset.zdlProcessed = run.uid;
      const detailReady = await this.openDetail(item, run);
      if (!Delivery.isCurrent(run)) return;
      if (!detailReady) {
        this.log(`第${idx}/${cumulativeTotal}个，${info}，详情加载超时，已跳过`);
        state.currentIndex++;
        return;
      }

      let activeTime = "未知";
      const onlineTag = document.querySelector(".boss-online-tag");
      if (onlineTag && onlineTag.textContent.trim() === "在线") {
        activeTime = "在线";
      } else {
        const activeTimeElement = document.querySelector(".boss-active-time");
        activeTime = activeTimeElement?.textContent?.trim() || "未知";
      }

      if (activeStatusFilter.length > 0 && !activeStatusFilter.includes(activeTime)) {
        this.log(`第${idx}/${cumulativeTotal}个，${info}，招聘者"${activeTime}"，已跳过`);
        state.currentIndex++;
        return;
      }

      let matchReason = "";
      if (state.detailBlockedTags.length || state.detailRequiredTags.length || state.detailOptionalTags.length || state.recruiterBlockedTags.length) {
        const descEl = document.querySelector(".job-detail-body .desc");
        const descText = cleanDesc(descEl).toLowerCase();

        // 禁止关键词：只匹配 desc（支持正则）
        if (state.detailBlockedTags.length) {
          const hitBlocked = state.detailBlockedTags.find((kw) => matchKeyword(descText, kw));
          if (hitBlocked) {
            this.log(`第${idx}/${cumulativeTotal}个，${info}，命中禁止关键词"${hitBlocked}"，已跳过`);
            state.currentIndex++;
            return;
          }
        }

        // 必须/可选关键词：四源匹配（job-label-list、desc、.job-name、.tag-list）
        // 限定在详情面板内查询，避免左侧岗位列表的标签污染
        if (state.detailRequiredTags.length || state.detailOptionalTags.length) {
          const detailScope = descEl ? (descEl.closest(".job-detail-container") || document) : document;
          const labels = Array.from(detailScope.querySelectorAll(".job-label-list li"))
            .map((li) => li.textContent.trim().toLowerCase()).join(" ");
          const jobName = (detailScope.querySelector(".job-name")?.textContent || "").toLowerCase();
          const tagList = Array.from(detailScope.querySelectorAll(".tag-list li"))
            .map((li) => li.textContent.trim().toLowerCase()).join(" ");
          const wideText = labels + " " + descText + " " + jobName + " " + tagList;

          if (state.detailRequiredTags.length) {
            const missedRequired = state.detailRequiredTags.find((kw) => !matchKeyword(wideText, kw));
            if (missedRequired) {
              this.log(`第${idx}/${cumulativeTotal}个，${info}，缺必须关键词"${missedRequired}"，已跳过`);
              state.currentIndex++;
              return;
            }
            const matchedRequired = state.detailRequiredTags.filter((kw) => matchKeyword(wideText, kw));
            matchReason = (matchReason ? matchReason + "；" : "") + "必须\"" + matchedRequired.join("、") + "\"";
          }

          if (state.detailOptionalTags.length) {
            const matchedOptional = state.detailOptionalTags.filter((kw) => matchKeyword(wideText, kw));
            if (!matchedOptional.length) {
              this.log(`第${idx}/${cumulativeTotal}个，${info}，无匹配可选关键词，已跳过`);
              state.currentIndex++;
              return;
            }
            matchReason = (matchReason ? matchReason + "；" : "") + "可选\"" + matchedOptional.join("、") + "\"";
          }
        }

        if (state.recruiterBlockedTags.length) {
          const bossInfo = document.querySelector(".boss-info-attr");
          const bossText = bossInfo ? bossInfo.textContent.trim().toLowerCase() : "";
          const hitRecruiter = state.recruiterBlockedTags.find((kw) => matchKeyword(bossText, kw));
          if (hitRecruiter) {
            this.log(`第${idx}/${cumulativeTotal}个，${info}，招聘者职位命中"${hitRecruiter}"，已跳过`);
            state.currentIndex++;
            return;
          }
        }
      }

      state.currentIndex++;

      const chatBtn = document.querySelector("a.op-btn-chat");
      if (chatBtn) {
        const btnText = chatBtn.textContent.trim();
        if (btnText === "立即沟通") {
          if (!Delivery.isCurrent(run)) return;
          if (state.delivery.dailyCount >= state.targetCount || state.delivery.dailyCount >= CONFIG.DAILY_LIMIT) {
            this.log(`第${idx}/${cumulativeTotal}个，${info}，已达今日目标 ${state.targetCount} 次，自动停止`);
            stopProcess(run);
            return;
          }
          chatBtn.click();

          // 检测 BOSS 限制弹窗（120 提醒 / 150 上限）
          const isLimitReached = await this.handleLimitDialogs(run);
          if (!Delivery.isCurrent(run, true)) return;
          if (isLimitReached) {
            this.log(`第${idx}/${cumulativeTotal}个，${info}，BOSS限制：今日沟通已达150次上限，自动停止`);
            stopProcess(run);
            return;
          }

          const confirmed = await this.handleGreetingModal(item.company, item.logo, run);
          if (confirmed) {
            const reason = matchReason ? `，匹配 ${matchReason}` : "";
            this.log(`第${idx}/${cumulativeTotal}个，${info}，已投递${reason}`);
          } else if (Delivery.isCurrent(run, true)) {
            this.log(`第${idx}/${cumulativeTotal}个，${info}，未确认投递成功，未增加次数`);
          }
          return;
        }
      }
      this.log(`第${idx}/${cumulativeTotal}个，${info}，已跳过（无沟通按钮）`);
    },

    // 点开岗位并等右侧详情切换到这个岗位，避免用上一个岗位的详情做筛选。
    // 判断依据：详情标题与卡片职位名一致，且详情正文已变化（本来就显示该岗位时除外）。
    async openDetail(item, run) {
      const normalize = (text) => (text || "").replace(/\s+/g, "").toLowerCase();
      const wanted = normalize(item.job);
      const readDesc = () => cleanDesc(document.querySelector(".job-detail-body .desc"));
      const detailTitle = () => [...document.querySelectorAll(".job-name")]
        .find((el) => !el.closest("li.job-card-box, #boss-pro-panel"));
      const titleMatches = (el) => {
        const title = normalize(el?.textContent);
        return !!title && !!wanted && (title.includes(wanted) || wanted.includes(title));
      };
      const previousDesc = readDesc();
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
        return alreadyShown || desc !== previousDesc;
      }, CONFIG.DETAIL_TIMEOUT, 200);

      // 保留最短操作间隔，不因页面加载快而点得过快。
      const rest = CONFIG.OPERATION_INTERVAL - (Date.now() - startedAt);
      if (rest > 0) await this.delay(rest);
      return !!ready;
    },

    async handleLimitDialogs(run) {
      // 阻塞等待上限弹窗出现（120 提醒 / 150 上限），超时 2 秒自动返回
      const dialog = await this.waitFor(() => document.querySelector(".chat-block-dialog"), 2000, 400);
      if (!Delivery.isCurrent(run, true)) return false;
      if (!dialog) return false;

      const bodyText = dialog.querySelector(".chat-block-body")?.textContent || "";
      const is150Limit = bodyText.includes("150") || bodyText.includes("休息一下") || bodyText.includes("无法进行沟通");
      const sureBtn = dialog.querySelector(".default-btn.sure-btn");
      if (sureBtn) sureBtn.click();

      // 可能还有第二层弹窗
      await this.delay(400);
      if (!Delivery.isCurrent(run, true)) return is150Limit;
      const second = document.querySelector(".chat-block-dialog");
      if (second) {
        const btn2 = second.querySelector(".default-btn.sure-btn");
        if (btn2) btn2.click();
      }
      return is150Limit;
    },

    async handleGreetingModal(companyName, companyLogo, run) {
      // 阻塞等待"留在此页"按钮出现（无渐入动画，直接等 DOM 就绪，超时 5 秒）
      let btn = await this.waitFor(() =>
        [...document.querySelectorAll(".default-btn.cancel-btn")]
          .find((b) => b.textContent.trim() === "留在此页"),
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
          if (entry && typeof entry === "object") {
            entry.count = (entry.count || 0) + 1;
            if (_companyLogo && !entry.logo) entry.logo = _companyLogo;
          } else {
            state.deliveryHistory[today][_companyName] = { count: (typeof entry === "number" ? entry : 0) + 1, logo: _companyLogo || "" };
          }
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
        btn = [...document.querySelectorAll(".default-btn.cancel-btn")]
          .find((b) => b.textContent.trim() === "留在此页");
      }
      return true;
    },

    async simulateClick(element) {
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      const dispatchMouseEvent = (type, options = {}) => {
        const event = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: document.defaultView,
          clientX: x,
          clientY: y,
          ...options,
        });
        element.dispatchEvent(event);
      };

      dispatchMouseEvent("mouseover");
      await this.delay(CONFIG.DELAYS.SHORT);
      dispatchMouseEvent("mousemove");
      await this.delay(CONFIG.DELAYS.SHORT);
      dispatchMouseEvent("mousedown", { button: 0 });
      await this.delay(CONFIG.DELAYS.SHORT);
      dispatchMouseEvent("mouseup", { button: 0 });
      await this.delay(CONFIG.DELAYS.SHORT);
      dispatchMouseEvent("click", { button: 0 });
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

renderLogItem(logEntry) {
      const item = document.createElement("div");
      item.className = "zdl-log-item";
      const html = logEntry
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/已投递/g, '<span style="color:#16a34a;font-weight:600">已投递</span>')
        .replace(/已跳过/g, '<span style="color:#dc2626;font-weight:600">已跳过</span>');
      item.innerHTML = html;
      return item;
    },

    log(message) {
      const logEntry = `[${new Date().toLocaleTimeString()}] ${message}`;
      state.logEntries.push(logEntry);
      saveLogEntries();
      const logPanel = document.querySelector("#pro-log");
      if (logPanel) {
        const logItem = this.renderLogItem(logEntry);
        logPanel.appendChild(logItem);
        logPanel.scrollTop = logPanel.scrollHeight;
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
      if (state.isRunning) stopProcess(state.activeRun);
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
    if (!navigator.locks?.request) {
      showNotification("当前浏览器不支持投递任务锁，请使用新版 Chrome 或 Edge", "error");
      return;
    }
    const run = { uid: state.account.id, started: false, cancelled: false };
    state.activeRun = run;
    Delivery.render();
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
        state.jobList = [];
        state.currentIndex = 0;
        state.jobIndexOffset = 0;
        run.started = true;
        state.isRunning = true;
        Delivery.render();
        const startTime = new Date();
        Core.log(`开始自动海投，时间：${startTime.toLocaleTimeString()}`);
        const filters = [];
        if (state.coarseRequiredTags.length) filters.push(`必须职位【${state.coarseRequiredTags.join("、")}】`);
        if (state.includeTags.length) filters.push(`可选职位【${state.includeTags.join("、")}】`);
        filters.push(`工作地【${state.locationTags.join("、") || "不限"}】`);
        if (state.blockedCompanies.length) filters.push(`不收集公司【${state.blockedCompanies.join("、")}】`);
        if (state.coarseBlockedTags.length) filters.push(`禁收集职位【${state.coarseBlockedTags.join("、")}】`);
        if (state.detailBlockedTags.length) filters.push(`禁止【${state.detailBlockedTags.join("、")}】`);
        if (state.detailRequiredTags.length) filters.push(`必须【${state.detailRequiredTags.join("、")}】`);
        if (state.detailOptionalTags.length) filters.push(`可选【${state.detailOptionalTags.join("、")}】`);
        if (state.recruiterBlockedTags.length) filters.push(`过滤招聘者【${state.recruiterBlockedTags.join("、")}】`);
        Core.log(`筛选条件：${filters.join("，")}`);

        await Core.startProcessing(run);
      });
    } catch (error) {
      Core.log(`投递已停止：${state.account.error || error.message}`);
      showNotification(state.account.error || error.message, "error");
    } finally {
      if (state.activeRun === run) {
        state.isRunning = false;
        state.activeRun = null;
        Delivery.render();
      }
    }
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
        if (event.key === null || CONFIG_STORAGE_KEYS.includes(event.key)) configExternalChanged = true;
        if (event.key === null || CONFIG_STORAGE_KEYS.includes(event.key) || event.key === CONFIG_UNDO_KEY) UI._updateConfigControls();
      });
      window.addEventListener("focus", () => Delivery.sync());
      setInterval(() => Delivery.sync(), 1500);
      // 恢复持久化的日志条目到 DOM
      const hasHistory = state.logEntries.length > 0;
      const logPanel = document.querySelector("#pro-log");
      if (logPanel && hasHistory) {
        state.logEntries.forEach((entry) => {
          logPanel.appendChild(Core.renderLogItem(entry));
        });
        logPanel.scrollTop = logPanel.scrollHeight;
      }
      if (!hasHistory) {
        Core.log('欢迎使用海投助手，点击"启动"立即开始投递');
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

  const CSS = `
.zdl-tutorial{position:fixed;inset:0;box-sizing:border-box;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;color:#1f2937;font-family:"PingFang SC","Microsoft YaHei","Segoe UI",system-ui,sans-serif;overflow:hidden}
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
.zdl-config-controls .zdl-config-btn{min-height:28px;padding:3px 10px;border-color:transparent;background:transparent;color:#667894}
.zdl-config-controls .zdl-config-btn:not(:disabled):hover{border-color:var(--zdl-border);background:var(--zdl-secondary);color:var(--zdl-primary)}
.zdl-config-controls .zdl-config-text{margin:0 0 8px}
.zdl-config-controls>div:first-child:not([hidden]){display:flex;flex-direction:column;align-items:flex-end;margin-bottom:8px}
.zdl-config-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:5px 11px;border:1px solid var(--zdl-border);border-radius:7px;background:#fff;color:#53647e;font-family:inherit;font-size:12px;font-weight:500;line-height:1.5;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.zdl-config-btn:hover{border-color:#c3d4f7;background:var(--zdl-accent);color:var(--zdl-primary)}
.zdl-config-text{display:block;box-sizing:border-box;width:100%;margin:10px 0;padding:10px 12px;border:1px solid var(--zdl-border);border-radius:8px;background:var(--zdl-secondary);color:var(--zdl-ink);font:12px/1.7 ui-monospace,monospace;resize:vertical;user-select:text}
.zdl-config-status{flex:1;min-width:0;font-size:12px;line-height:1.5;color:var(--zdl-neutral);overflow-wrap:anywhere}
.zdl-config-status.error{color:#dc2626}
.zdl-config-btn[hidden]{display:none}
.zdl-config-btn:disabled{opacity:.5;cursor:default}
.zdl-config-scope{margin:8px 0 0;color:var(--zdl-neutral);font-size:11px;line-height:1.7}
.zdl-import-dialog{position:fixed;inset:0;box-sizing:border-box;width:min(480px,calc(100vw - 24px));height:fit-content;max-width:none;max-height:calc(100vh - 24px);margin:auto;padding:18px;border:1px solid var(--zdl-border);border-radius:14px;background:#fff;color:var(--zdl-ink);font-family:"PingFang SC","Microsoft YaHei","Segoe UI",system-ui,sans-serif;box-shadow:0 18px 70px rgba(23,36,58,.2);overflow:hidden}
.zdl-import-dialog[open]{display:flex;flex-direction:column}
.zdl-import-dialog::backdrop{background:rgba(23,36,58,.3)}
.zdl-import-body{min-height:0;overflow:auto}
.zdl-import-body .zdl-config-scope{margin-top:0}
.zdl-import-body .zdl-config-text{min-height:80px;max-height:32vh}
.zdl-import-feedback{margin:0 0 10px;color:#53647d;font-size:12px;line-height:1.7}
.zdl-import-feedback.error{color:#dc2626}
.zdl-config-diff{margin:0;font-size:12px;line-height:1.7}
.zdl-config-diff>div{padding:9px 0;border-top:1px solid var(--zdl-border)}
.zdl-config-diff dt{color:var(--zdl-ink);font-weight:500}
.zdl-config-diff dd{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin:3px 0 0;overflow-wrap:anywhere}
.zdl-config-diff dd>*{min-width:0;max-width:100%;overflow-wrap:anywhere}
.zdl-config-before{color:var(--zdl-neutral)}
.zdl-config-arrow{color:#9ca9ba}
.zdl-config-diff strong{color:var(--zdl-primary);font-weight:500}
.zdl-import-footer{display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;margin-top:14px;padding-top:14px;border-top:1px solid var(--zdl-border)}
.zdl-config-primary{border-color:var(--zdl-primary);background:var(--zdl-primary);color:#fff}
.zdl-config-primary:not(:disabled):hover{background:#255fd3;color:#fff}
.zdl-import-dialog button:focus-visible,.zdl-import-dialog textarea:focus-visible{outline:2px solid #a6c0f7;outline-offset:2px}

.zdl-delivery-controls{padding:0 0 16px;flex-shrink:0}
.zdl-delivery-target{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.zdl-settings-open{margin-left:auto;min-height:36px;color:#435776;background:#fff}
.zdl-settings-panel{position:fixed;box-sizing:border-box;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 24px);padding:18px;border:1px solid var(--zdl-border);border-radius:14px;background:#fff;box-shadow:0 12px 40px rgba(23,36,58,.12),0 2px 6px rgba(23,36,58,.04);font-family:"PingFang SC","Microsoft YaHei","Segoe UI",system-ui,sans-serif;z-index:2147483647;display:flex;flex-direction:column;overflow:hidden}
.zdl-settings-panel[hidden]{display:none}
.zdl-settings-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--zdl-border);flex-shrink:0}
.zdl-settings-header h4{margin:0;font-size:15px;line-height:1.5;font-weight:600;color:var(--zdl-ink)}
.zdl-settings-panel .zdl-settings-scroll{flex:1;min-height:0;max-height:none;padding-right:3px;overflow:auto}
.zdl-panel{position:fixed;box-sizing:border-box;top:24px;right:16px;width:360px;height:456px;max-width:calc(100vw - 32px);max-height:calc(100vh - 48px);min-width:min(320px,calc(100vw - 32px));min-height:min(350px,calc(100vh - 48px));border-radius:16px;padding:18px;font-family:"PingFang SC","Microsoft YaHei","Segoe UI",system-ui,sans-serif;z-index:2147483647;display:flex;flex-direction:column;background:#fff;box-shadow:0 12px 40px rgba(23,36,58,.1),0 2px 6px rgba(23,36,58,.03);border:1px solid var(--zdl-border);overflow:hidden}
.zdl-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:10px;row-gap:14px;margin-bottom:16px;flex-shrink:0}
.zdl-btn-group{display:flex;align-items:center;gap:4px;flex-shrink:0}
.zdl-title-wrap{display:flex;align-items:center;gap:9px;min-width:0}
.zdl-title-icon{width:32px;height:32px;flex:0 0 32px;padding:5px;box-sizing:border-box;background:var(--zdl-primary);border-radius:9px;display:flex;justify-content:center;align-items:center;color:#fff}
.zdl-title-text h3{margin:0;color:var(--zdl-ink);font-weight:600;font-size:16px;line-height:1.4;white-space:nowrap}
.zdl-title-text span{font-size:12px;color:var(--zdl-neutral)}
.zdl-filter-container{background:transparent;padding:0;margin:0}
.zdl-filter-row{display:flex;gap:10px;margin-bottom:12px}
.zdl-filter-col{flex:1}
.zdl-filter-label{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:12px;line-height:1.6;flex-shrink:0}
.zdl-filter-title{font-weight:500;color:#43536c}
.zdl-filter-desc{color:#98a4b5;font-size:11px}
.zdl-filter-input{width:100%;padding:8px 10px;border-radius:8px;border:1px solid #d1d5db;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.05);transition:all .2s ease}
.zdl-btn-start{box-sizing:border-box;width:100%;min-height:42px;padding:10px 16px;background:var(--zdl-primary);color:#fff;border:none;border-radius:9px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;line-height:1.5;transition:background .15s,box-shadow .15s;display:flex;justify-content:center;align-items:center;box-shadow:0 3px 8px rgba(var(--zdl-primary-rgb),.15);margin:0 auto}
.zdl-btn-start:hover{background:#255fd3;box-shadow:0 4px 12px rgba(var(--zdl-primary-rgb),.22)}
.zdl-icon-btn{box-sizing:border-box;width:28px;height:28px;flex:0 0 28px;padding:5px;border-radius:7px;border:1px solid transparent;background:transparent;cursor:pointer;display:flex;justify-content:center;align-items:center;color:#7b8aa1;transition:background .15s,color .15s,border-color .15s}
.zdl-icon-btn:hover{background:var(--zdl-secondary);color:var(--zdl-primary)}
.zdl-icon-btn.pinned{background:var(--zdl-accent);border-color:#dbe7ff;color:var(--zdl-primary)}
.zdl-icon-btn.svg-btn{padding:5px}
.zdl-log{flex:1;min-height:0;overflow-y:auto;background:transparent;padding:10px 12px;font-size:12px;line-height:1.8;margin:0;color:#53647e;user-select:text;scrollbar-width:thin;scrollbar-color:#c5d1e2 transparent}
.zdl-log::-webkit-scrollbar{width:6px}
.zdl-log::-webkit-scrollbar-track{background:var(--zdl-secondary);border-radius:4px}
.zdl-log::-webkit-scrollbar-thumb{background:#c5d1e2;border-radius:4px}
.zdl-log-item{padding:3px 0;overflow-wrap:anywhere}
.zdl-scroll-wrap{flex:0 0 auto;overflow-y:auto;max-height:55%;min-height:60px;scrollbar-width:thin;scrollbar-color:#c5d1e2 transparent}
.zdl-scroll-wrap::-webkit-scrollbar{width:6px}
.zdl-scroll-wrap::-webkit-scrollbar-track{background:transparent;border-radius:4px}
.zdl-scroll-wrap::-webkit-scrollbar-thumb{background:#c5d1e2;border-radius:4px}
.zdl-resize-handle{position:absolute;right:4px;bottom:4px;width:12px;height:12px;cursor:nwse-resize;opacity:.55;background:linear-gradient(135deg,transparent 50%,#b4c1d4 50%,transparent 55%,#b4c1d4 55%,transparent 60%,#b4c1d4 60%);z-index:2}
.zdl-footer{text-align:center;font-size:.8em;color:var(--zdl-neutral);padding:0;border-top:1px solid var(--zdl-accent);margin-top:auto}
.zdl-footer-stats{display:flex;justify-content:space-around;margin-bottom:15px}
.zdl-mini-icon{width:40px;height:40px;position:fixed;bottom:40px;left:40px;background:var(--zdl-primary);border-radius:50%;box-shadow:0 6px 16px rgba(var(--zdl-primary-rgb),.4);cursor:pointer;display:none;justify-content:center;align-items:center;color:#fff;z-index:2147483647;transition:all .3s ease;overflow:hidden;user-select:none}
.zdl-status-tags{display:contents}
.zdl-status-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;font-family:inherit;border-radius:6px;font-size:12px;line-height:1.5;cursor:pointer;transition:background .15s,color .15s,border-color .15s;white-space:nowrap;background:#fff;color:#7b8aa1;border:1px solid var(--zdl-border);user-select:none}
.zdl-status-chip:hover{background:var(--zdl-secondary)}
.zdl-status-chip.active{background:var(--zdl-accent);color:#315fba;border-color:#d4e2ff}
.zdl-status-chip.active:hover{background:#e1ebff}
.zdl-status-check{position:relative;width:12px;height:12px;flex-shrink:0;box-sizing:border-box;border:1.5px solid #b4c1d4;border-radius:3px;background:#fff;transition:background .15s,border-color .15s}
.zdl-status-chip.active .zdl-status-check{border-color:var(--zdl-primary);background:var(--zdl-primary)}
.zdl-status-chip.active .zdl-status-check::after{content:"";position:absolute;left:2.5px;top:0;width:3px;height:6px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
.zdl-notify{position:fixed;top:20px;left:50%;transform:translateX(-50%);color:#fff;padding:10px 15px;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,.2);z-index:9999999;opacity:0;transition:opacity .3s ease}
.zdl-tag-section{margin-bottom:12px}
.zdl-collapse-body .zdl-tag-section+.zdl-tag-section{border-top:1px solid #edf0f5;padding-top:12px}
.zdl-tag-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.zdl-tag-list{display:contents}
.zdl-tag-add-trigger{width:24px;height:24px;border-radius:6px;border:1px dashed #c3cede;background:#fff;color:#7b8aa1;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;transition:border-color .15s,color .15s,background .15s;line-height:1;font-weight:500;vertical-align:middle}
.zdl-tag-add-trigger:hover{border-color:var(--zdl-primary);color:var(--zdl-primary);background:var(--zdl-accent)}
.zdl-tag{display:inline-flex;align-items:center;gap:5px;max-width:100%;box-sizing:border-box;padding:4px 7px;border-radius:6px;font-size:12px;line-height:1.5;cursor:pointer;transition:background .15s;white-space:nowrap;background:#edf3fe;color:#41638f;border:1px solid #dfe8f7}
.zdl-tag:hover{background:#e4ecfa}
.zdl-tag.blocked{background:#fff1f0;color:#ad4a4a;border:1px solid #f5dada}
.zdl-tag.blocked:hover{background:#fce5e3}
.zdl-tag.required{background:#fff7e8;color:#8a621e;border:1px solid #f1e4c8}
.zdl-tag.required:hover{background:#f9efd8}
.zdl-tag.optional{background:#edf3fe;color:#41638f;border:1px solid #dfe8f7}
.zdl-tag.optional:hover{background:#e4ecfa}
.zdl-collapse-header{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;line-height:1.6;font-weight:500;color:#43536c;padding:11px 12px;margin:0;border:0;user-select:none;transition:background .15s,color .15s}
.zdl-filter-container>div:first-child>.zdl-collapse-header{border-top:none;margin-top:0}
.zdl-collapse-header:hover{color:var(--zdl-primary);background:var(--zdl-secondary)}
.zdl-collapse-arrow{font-size:9px;width:10px;opacity:.65;flex-shrink:0}
.zdl-collapse-body{padding:12px;border-top:1px solid var(--zdl-border);overflow:visible}
.zdl-collapse-body.collapsed{display:none}
.zdl-tag-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.zdl-tag-remove{width:14px;height:14px;border-radius:4px;border:none;background:transparent;color:inherit;opacity:.65;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}
.zdl-tag-remove:hover{background:rgba(23,36,58,.08);opacity:1}
.zdl-tag-input-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px;min-width:0}
.zdl-tag-hint{flex-basis:100%;margin:0;color:#98a4b5;font-size:11px;line-height:1.6}
.zdl-tag-hint code{padding:0 3px;border-radius:3px;background:var(--zdl-secondary);color:#53647e;font:11px ui-monospace,monospace}
.zdl-tag-input{box-sizing:border-box;min-width:0;flex:1;padding:7px 9px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;line-height:1.5;background:#fff;color:var(--zdl-ink);outline:none;transition:border-color .15s,box-shadow .15s}
.zdl-tag-input:focus{border-color:#a6c0f7;box-shadow:0 0 0 2px var(--zdl-accent)}
.zdl-tag-add-btn{padding:6px 11px;background:var(--zdl-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap}
.zdl-tag-add-btn:hover{filter:brightness(1.1)}
.zdl-tag-inline{display:contents}
.zdl-salary-select{box-sizing:border-box;height:32px;padding:4px 7px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;background:#fff;color:#53647e;cursor:pointer;flex-shrink:0}
.zdl-salary-input{box-sizing:border-box;height:32px;padding:4px 7px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;background:#fff;color:var(--zdl-ink);outline:none;flex-shrink:0;text-align:center}
.zdl-salary-input:focus{border-color:var(--zdl-primary)}
.zdl-tag.editing{outline:2px solid var(--zdl-primary);outline-offset:2px;border-radius:14px}
.zdl-tag.dragging{opacity:0.4}
.zdl-tag.drag-over{box-shadow:inset 0 0 0 2px var(--zdl-primary)}
.zdl-history-panel{position:fixed;box-sizing:border-box;top:24px;right:16px;width:min(360px,calc(100vw - 24px));max-height:min(500px,calc(100vh - 48px));min-height:180px;border-radius:14px;padding:18px;font-family:"PingFang SC","Microsoft YaHei","Segoe UI",system-ui,sans-serif;z-index:2147483646;display:flex;flex-direction:column;background:#fff;box-shadow:0 12px 40px rgba(23,36,58,.12),0 2px 6px rgba(23,36,58,.04);border:1px solid var(--zdl-border);overflow:hidden}
.zdl-hist-header{display:flex;justify-content:space-between;align-items:center;padding:0 0 12px;border-bottom:1px solid var(--zdl-border);flex-shrink:0}
.zdl-hist-header h4{margin:0;font-size:15px;line-height:1.5;font-weight:600;color:var(--zdl-ink)}
#zdl-hist-close{display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:5px;border:0;border-radius:7px;background:transparent;color:#7b8aa1;cursor:pointer;box-sizing:border-box}
#zdl-hist-close:hover{background:var(--zdl-secondary);color:var(--zdl-primary)}
.zdl-hist-empty{text-align:center;padding:40px 20px;color:#9ca3af}
.zdl-hist-date-row{display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid var(--zdl-border);flex-shrink:0;font-size:12px;color:var(--zdl-neutral)}
.zdl-hist-select{box-sizing:border-box;min-width:0;height:32px;padding:4px 7px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;color:#53647e;background:#fff;cursor:pointer;outline:none;flex:1}
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
.zdl-hist-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1f2937}
.zdl-hist-count{flex-shrink:0;font-weight:500;color:var(--zdl-primary);font-size:12px;font-variant-numeric:tabular-nums}
.zdl-hist-action{flex-shrink:0;margin-left:8px}
.zdl-hist-block-btn{padding:3px 8px;border:1px solid #f2d5d5;border-radius:5px;font-size:11px;line-height:1.5;cursor:pointer;background:#fff;color:#ad4a4a;transition:background .15s}
.zdl-hist-block-btn:hover{background:#fef2f2}
.zdl-hist-block-btn.blocked{background:#fff1f0;border-color:#f2d5d5;color:#ad4a4a}
.zdl-panel,.zdl-settings-panel,.zdl-history-panel,.zdl-tutorial,.zdl-import-dialog,.zdl-entry{--zdl-border:#e4eaf3;--zdl-ink:#17243a}
.zdl-entry{position:fixed;top:80px;right:24px;z-index:2147483646;box-sizing:border-box;width:min(280px,calc(100vw - 32px));padding:14px;border:1px solid #c9d9fb;border-top:3px solid var(--zdl-primary);border-radius:14px;background:#fff;box-shadow:0 16px 44px rgba(23,36,58,.2),0 2px 8px rgba(23,36,58,.06);font-family:"PingFang SC","Microsoft YaHei","Segoe UI",system-ui,sans-serif;animation:zdl-entry-in .35s ease,zdl-entry-nudge .6s ease .9s 2}
.zdl-entry-head{display:flex;align-items:center;gap:10px}
.zdl-entry-icon{position:relative;display:flex;width:38px;height:38px;flex:0 0 38px;box-sizing:border-box;padding:7px;border-radius:11px;background:var(--zdl-primary)}
.zdl-entry-icon::after{content:"";position:absolute;inset:-4px;border-radius:14px;border:2px solid var(--zdl-primary);opacity:0;animation:zdl-entry-ring 1.6s ease-out .4s 3}
.zdl-entry-text{display:flex;flex-direction:column;flex:1;min-width:0;line-height:1.45}
.zdl-entry-text strong{font-size:14px;font-weight:600;color:var(--zdl-ink)}
.zdl-entry-text span{font-size:12px;color:#667894}
.zdl-entry-close{align-self:flex-start;width:24px;height:24px;flex:0 0 24px;padding:0;border:0;border-radius:6px;background:transparent;color:#9aa6b8;font-size:18px;line-height:1;cursor:pointer}
.zdl-entry-close:hover{background:var(--zdl-secondary);color:var(--zdl-ink)}
.zdl-entry-link{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:38px;margin-top:12px;padding:8px 14px;border-radius:9px;background:var(--zdl-primary);color:#fff!important;font-size:13px;font-weight:500;text-decoration:none;box-shadow:0 3px 8px rgba(var(--zdl-primary-rgb),.22);transition:background .15s}
.zdl-entry-link:hover{background:#255fd3}
.zdl-entry-link:focus-visible,.zdl-entry-close:focus-visible{outline:2px solid #a6c0f7;outline-offset:2px}
@keyframes zdl-entry-in{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
@keyframes zdl-entry-nudge{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(3px)}}
@keyframes zdl-entry-ring{0%{opacity:.6;transform:scale(.9)}100%{opacity:0;transform:scale(1.35)}}
.zdl-collapse-title{flex-shrink:0}
.zdl-collapse-desc{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#98a4b5;font-size:11px;font-weight:400}
.zdl-collapse-count{margin-left:auto;flex-shrink:0;padding:0 7px;border-radius:10px;background:var(--zdl-accent);color:var(--zdl-primary);font-size:11px;font-weight:500;line-height:1.8;font-variant-numeric:tabular-nums}
.zdl-collapse-count.empty{background:transparent;color:#a9b4c4;font-weight:400}
.zdl-salary-input{width:64px}
.zdl-salary-sep{flex-shrink:0;color:#98a4b5;font-size:13px}
.zdl-salary-unit{flex-shrink:0;color:#667894;font-size:12px;white-space:nowrap}
.zdl-hist-row.blocked .zdl-hist-name,.zdl-hist-row.blocked .zdl-hist-count{color:#a9b4c4}
.zdl-hist-row.blocked .zdl-hist-logo,.zdl-hist-row.blocked .zdl-hist-no-logo{opacity:.45}
.zdl-title-text{min-width:0}
.zdl-stats-strip{grid-column:1/-1;padding:9px 11px;border:1px solid #e4ecfa;border-left:3px solid var(--zdl-primary);border-radius:7px;background:var(--zdl-secondary);color:#667894;font-size:12px;line-height:1.6;font-variant-numeric:tabular-nums;user-select:text}
.zdl-stats-strip #zdl-subtitle,.zdl-stats-strip #zdl-machine-stats{display:block;overflow-wrap:anywhere}
.zdl-stats-strip #zdl-subtitle{color:var(--zdl-ink);font-weight:500}
.zdl-account-status{display:block;margin-top:4px;color:#c05621;overflow-wrap:anywhere}
.zdl-account-status:empty{display:none}
.zdl-machine-stats-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.zdl-accounts-toggle{margin-left:auto;padding:1px 6px;border:1px solid #dce6f8;border-radius:5px;background:#fff;color:var(--zdl-primary);font:inherit;font-size:11px;line-height:1.6;white-space:nowrap;cursor:pointer}
.zdl-accounts-toggle:hover,.zdl-accounts-toggle[aria-expanded=true]{background:var(--zdl-accent);border-color:#bcd0f6}
.zdl-accounts-panel{width:min(380px,calc(100vw - 24px))}
.zdl-accounts-content{min-height:0;overflow:auto}
.zdl-accounts-summary{margin:0 0 12px;color:#53647d;font-size:12px;line-height:1.7;font-variant-numeric:tabular-nums}
.zdl-accounts-table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.7;font-variant-numeric:tabular-nums}
.zdl-accounts-table th,.zdl-accounts-table td{padding:9px 8px;border-bottom:1px solid var(--zdl-border);white-space:nowrap}
.zdl-accounts-table thead th{background:var(--zdl-secondary);color:#728096;font-weight:500}
.zdl-accounts-table th:first-child{text-align:left;font-weight:500}
.zdl-accounts-table th:not(:first-child),.zdl-accounts-table td{text-align:right}
.zdl-accounts-table .zdl-current-account{background:var(--zdl-accent);color:var(--zdl-primary)}
.zdl-current-badge{display:inline-block;margin-left:6px;padding:0 4px;border-radius:4px;background:#fff;color:var(--zdl-primary);font-size:10px;vertical-align:middle}
.zdl-accounts-note{margin:12px 0 0;color:var(--zdl-neutral);font-size:11px;line-height:1.7}
.zdl-accounts-error{margin:0;color:#c05621;font-size:12px;line-height:1.7}
.zdl-btn-start:disabled{opacity:.55;cursor:default;box-shadow:none}
.zdl-target-label,.zdl-target-unit{font-size:12px;line-height:1.5;white-space:nowrap;color:#667894}
.zdl-target-input{box-sizing:border-box;width:64px;height:36px;flex:0 0 64px;padding:5px 8px;border:1px solid var(--zdl-border);border-radius:7px;background:var(--zdl-secondary);color:var(--zdl-ink);font:500 14px/1.5 ui-monospace,monospace;text-align:center;font-variant-numeric:tabular-nums}
.zdl-settings-open svg{width:14px;height:14px;flex-shrink:0}
.zdl-icon-btn svg,#zdl-hist-close svg{width:100%;height:100%;display:block}
.zdl-log-section{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--zdl-border);border-radius:10px;background:var(--zdl-secondary)}
.zdl-log-heading{padding:9px 12px;border-bottom:1px solid var(--zdl-border);font-size:11px;font-weight:500;line-height:1.5;color:#7b8aa1;flex-shrink:0}
.zdl-filter-group{margin-bottom:10px;border:1px solid var(--zdl-border);border-radius:9px;overflow:hidden;background:#fff}
.zdl-filter-group:last-child{margin-bottom:0}
.zdl-tag-row>.zdl-filter-label{flex-basis:100%;margin-bottom:2px}
.zdl-collapse-body>.zdl-tag-section:last-child{margin-bottom:0}
.zdl-panel button:focus-visible,.zdl-settings-panel button:focus-visible,.zdl-history-panel button:focus-visible,.zdl-target-input:focus-visible,.zdl-salary-select:focus-visible,.zdl-config-text:focus-visible{outline:2px solid #a6c0f7;outline-offset:2px}
@media(max-width:380px){.zdl-panel{padding:14px}.zdl-header{column-gap:8px}.zdl-title-wrap{gap:7px}.zdl-title-icon{width:30px;height:30px;flex-basis:30px}.zdl-title-text h3{font-size:14px}.zdl-btn-group{gap:2px}.zdl-header .zdl-icon-btn{width:26px;height:26px;flex-basis:26px}.zdl-delivery-target{gap:6px}.zdl-settings-open{padding:5px 8px}.zdl-settings-panel{padding:14px}}
@media(prefers-reduced-motion:reduce){.zdl-panel *,.zdl-settings-panel *,.zdl-history-panel *{transition:none!important}.zdl-entry,.zdl-entry-icon::after{animation:none}}

`;

  function injectCSS() {
    if (document.getElementById("zdl-styles")) return;
    const style = document.createElement("style");
    style.id = "zdl-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
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
