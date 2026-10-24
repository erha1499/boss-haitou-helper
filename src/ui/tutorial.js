import { elements, state } from "../state.js";
import { collapseInstances } from "./settings.js";

export const TUTORIAL_SEEN_KEY = "zdlTutorialSeen";

export let tutorialShownInPage = false;

export const TutorialMethods = {
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
