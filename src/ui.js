import { CONFIG, RECRUITER_STATUS_OPTIONS, REPO_URL, getStoredJSON } from "./config.js";
import { toggleProcess } from "./core.js";
import { Delivery } from "./delivery.js";
import { hasFilterRules, jobTypeFilterActive } from "./filters.js";
import { CoarsePreview } from "./preview.js";
import { JOB_TYPES, JOB_YEARS, normalizeJobTypeFilter } from "./rules/job-type.js";
import { WIZARD_DIRECTIONS, WIZARD_STACKS, defaultWizardAnswers, generateWizardConfig } from "./rules/wizard.js";
import { CONFIG_STORAGE_KEYS, canUndoConfigImport, configExternalChanged, exportConfig, getConfigChanges, getConfigUndo, getCurrentConfig, importConfig, invalidateConfigUndo, parseConfig, saveTags, undoConfigImport } from "./settings-store.js";
import { elements, saveLogEntries, state } from "./state.js";

export const collapseInstances = [];
export const TUTORIAL_SEEN_KEY = "zdlTutorialSeen";
export let tutorialShownInPage = false;
export const UI_ICONS = {
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
export const SVG_ICON = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;fill:white;"><path d="M512 116.032a160 160 0 0 1 52.224 311.232v259.008c118.144-22.272 207.552-121.088 207.552-239.36 0-25.152 21.568-45.568 48.128-45.568 26.624 0 48.128 20.416 48.128 45.632 0 184.832-158.848 335.232-354.048 335.232S160 631.808 160 446.976c0-25.152 21.568-45.632 48.128-45.632 26.624 0 48.128 20.48 48.128 45.632 0 118.144 89.088 216.96 206.976 239.296V428.416A160.064 160.064 0 0 1 512 116.032z m0 96a64 64 0 1 0 0 128 64 64 0 0 0 0-128z m-36.672 668.48l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.952 19.584a56.32 56.32 0 0 1-77.504 0l-21.952-19.584a17.92 17.92 0 0 0-24.64 0l-28.288 25.6c-9.6 8.704-23.36 6.4-30.72-4.992a29.696 29.696 0 0 1 4.16-36.672l28.352-25.6a56.32 56.32 0 0 1 77.568 0l21.888 19.584a17.92 17.92 0 0 0 24.704 0l21.824-19.52a56.32 56.32 0 0 1 77.568 0l21.888 19.52a17.92 17.92 0 0 0 24.64 0l21.952-19.52a56.32 56.32 0 0 1 77.504 0l21.952 19.52a17.92 17.92 0 0 0 24.64 0l21.824-19.52a56.32 56.32 0 0 1 77.632 0l21.824 19.52c9.664 8.704 11.52 25.152 4.224 36.672-7.296 11.52-21.12 13.696-30.72 4.992l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.888 19.584a56.32 56.32 0 0 1-77.568 0l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.888 19.584a57.408 57.408 0 0 1-38.656 15.488 58.176 58.176 0 0 1-38.784-15.488z"/></svg>`;

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

export const UI = {
  init() {
    this._applyTheme();
    this.createControlPanel();
    this.createMiniIcon();

    document.addEventListener("click", (e) => {
      if (!e.isTrusted) return;
      if (document.getElementById("zdl-tutorial")?.contains(e.target)) return;
      if (elements.configDialog?.contains(e.target)) return;
      if (elements.wizardDialog?.contains(e.target)) return;
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
      if (elements.configDialog.open || elements.wizardDialog?.open) return;
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
    });
    logHeading.append(logTitle, clearLog);
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

export function renderTagList(container, tags, tagType = "", editIndex) {
  container.innerHTML = "";
  tags.forEach((tag, i) => {
    const tagEl = createTagElement(tag, i, tags, container, tagType, editIndex);
    container.appendChild(tagEl);
  });
  CoarsePreview.schedule();
}

export function createTagElement(text, index, tags, container, tagType = "", editIndex) {
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

export function toggleStatusOption(value, chip) {
  const idx = state.settings.recruiterActivityStatus.indexOf(value);
  if (idx >= 0) state.settings.recruiterActivityStatus.splice(idx, 1);
  else state.settings.recruiterActivityStatus.push(value);
  chip.classList.toggle("active", idx < 0);
  chip.setAttribute("aria-pressed", String(idx < 0));
  invalidateConfigUndo();
  localStorage.setItem("recruiterActivityStatus", JSON.stringify(state.settings.recruiterActivityStatus));
  UI._refreshFilterCounts();
}

export function showNotification(message, type = "success") {
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
