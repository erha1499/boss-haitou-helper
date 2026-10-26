import { CONFIG, REPO_URL, getStoredJSON } from "../config.js";
import { toggleProcess } from "../core.js";
import { Delivery } from "../delivery.js";
import { invalidateConfigUndo } from "../settings-store.js";
import { elements, saveLogEntries, state } from "../state.js";
import { SVG_ICON, UI_ICONS } from "./icons.js";
import { UI } from "./index.js";
import { collapseInstances } from "./settings.js";

export const PANEL_MOTION = "transform .26s cubic-bezier(.4,0,.2,1), opacity .2s ease";

export const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export let panelMotionTimer = 0;


// 让面板以小图标为中心缩放，收起和展开看起来是同一个东西。
export function setPanelOriginToIcon() {
  const panelRect = elements.panel.getBoundingClientRect();
  // 用布局位置而不是 getBoundingClientRect，图标的弹出动画会改变后者的尺寸。
  const icon = elements.miniIcon;
  const iconX = icon.offsetLeft + icon.offsetWidth / 2;
  const iconY = icon.offsetTop + icon.offsetHeight / 2;
  elements.panel.style.transformOrigin = `${iconX - panelRect.left}px ${iconY - panelRect.top}px`;
}


export function minimizePanel() {
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


export function restorePanel() {
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

export const PanelMethods = {
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
    // 有被细筛跳过的岗位时显示，点开复查、补投
    elements.remedyBtn = document.createElement("button");
    elements.remedyBtn.type = "button";
    elements.remedyBtn.className = "zdl-remedy-btn";
    elements.remedyBtn.hidden = true;
    elements.remedyBtn.title = "查看今天被细筛跳过的岗位，误跳过的可以补投";
    elements.remedyBtn.addEventListener("click", () => this._showRemedyPanel());
    logTools.append(elements.remedyBtn, tabs, clearLog);
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
    this._refreshRemedyButton();
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
