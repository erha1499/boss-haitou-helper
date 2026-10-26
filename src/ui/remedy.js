import { CONFIG } from "../config.js";
import { findCardById, startRemedy } from "../core.js";
import { CoarsePreview } from "../preview.js";
import { SkippedJobs } from "../skipped.js";
import { elements, state } from "../state.js";
import { UI_ICONS } from "./icons.js";

// “可补投”面板：列出今天被细筛跳过的岗位和原因，勾选误跳过的直接补投。
export const RemedyMethods = {
  // 日志顶部“可补投 N”按钮：有记录时才显示
  _refreshRemedyButton() {
    const btn = elements.remedyBtn;
    if (!btn) return;
    const count = state.account.id ? SkippedJobs.list(state.account.id).length : 0;
    btn.hidden = !count;
    btn.textContent = `可补投 ${count}`;
  },

  _showRemedyPanel() {
    this._hideSettingsPanel();
    this._hideAccountsPanel();
    document.getElementById("zdl-history-panel")?.remove();
    const existing = document.getElementById("zdl-remedy-panel");
    if (existing) { existing.remove(); return; }

    const uid = state.account.id;
    const panel = document.createElement("div");
    panel.id = "zdl-remedy-panel";
    panel.className = "zdl-history-panel zdl-remedy-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "可补投的岗位");

    const header = document.createElement("div");
    header.className = "zdl-hist-header";
    const title = Object.assign(document.createElement("h4"), { textContent: "可补投的岗位" });
    const closeBtn = document.createElement("button");
    closeBtn.id = "zdl-hist-close";
    closeBtn.type = "button";
    closeBtn.innerHTML = UI_ICONS.close;
    closeBtn.setAttribute("aria-label", "关闭可补投的岗位");
    header.append(title, closeBtn);

    const hint = Object.assign(document.createElement("p"), {
      className: "zdl-remedy-hint",
      textContent: "今天被细筛跳过的岗位。勾选误跳过的点「补投选中」：跳过细筛直接沟通，其余和正常投递一样，计入今日次数，到今日目标就停。",
    });
    const listWrap = document.createElement("div");
    listWrap.className = "zdl-hist-list";

    const footer = document.createElement("div");
    footer.className = "zdl-remedy-footer";
    const selectAll = this._createTextButton("全选", () => {
      const boxes = [...listWrap.querySelectorAll("input:not(:disabled)")];
      const check = boxes.some((box) => !box.checked);
      boxes.forEach((box) => { box.checked = check; });
      updateFooter();
    });
    const removeBtn = this._createTextButton("移出列表", () => {
      SkippedJobs.remove(uid, selectedIds());
      render();
      this._refreshRemedyButton();
    });
    const deliverBtn = this._createTextButton("补投选中", () => {
      const ids = selectedIds();
      const items = SkippedJobs.list(uid).filter((item) => ids.includes(item.jobId));
      close();
      startRemedy(items);
    });
    [selectAll, removeBtn].forEach((btn) => { btn.className = "zdl-config-btn"; });
    deliverBtn.className = "zdl-config-btn zdl-config-primary";
    footer.append(selectAll, removeBtn, deliverBtn);

    const selectedIds = () => [...listWrap.querySelectorAll("input:checked")].map((box) => box.value);
    const updateFooter = () => {
      const n = selectedIds().length;
      const busy = !!state.activeRun;
      const full = state.delivery.dailyCount >= Math.min(state.targetCount, CONFIG.DAILY_LIMIT);
      deliverBtn.textContent = busy ? "投递中，稍后再补投" : full ? "已达今日目标，调高目标后再补投"
        : n ? `补投选中（${n}）` : "补投选中";
      deliverBtn.disabled = busy || full || !n;
      removeBtn.disabled = !n;
      selectAll.disabled = !listWrap.querySelector("input:not(:disabled)");
    };

    const render = () => {
      listWrap.replaceChildren();
      const items = uid ? SkippedJobs.list(uid) : [];
      if (!items.length) {
        listWrap.appendChild(Object.assign(document.createElement("div"), { className: "zdl-hist-empty", textContent: "今天还没有被跳过的岗位" }));
      }
      items.forEach((item) => {
        const card = findCardById(item.jobId);
        const row = document.createElement("label");
        row.className = "zdl-hist-row zdl-remedy-row" + (card ? "" : " missing");
        const box = Object.assign(document.createElement("input"), { type: "checkbox", value: item.jobId, disabled: !card });
        box.addEventListener("change", updateFooter);
        const names = document.createElement("div");
        names.className = "zdl-hist-names";
        const name = Object.assign(document.createElement("span"), { className: "zdl-hist-name", textContent: item.title });
        const meta = Object.assign(document.createElement("span"), {
          className: "zdl-hist-jobs", textContent: [item.company, item.salary].filter(Boolean).join(" · "),
        });
        const reason = Object.assign(document.createElement("span"), { className: "zdl-remedy-reason", textContent: item.reason, title: item.reason });
        names.append(name, meta, reason);
        let action;
        if (card) {
          action = this._createTextButton("定位", (event) => {
            event.preventDefault();
            CoarsePreview.locate(card);
          });
          action.title = "在页面上定位这个岗位";
        } else {
          // 刷新或换了搜索后卡片不在当前页了，只能打开岗位页手动沟通
          action = Object.assign(document.createElement("a"), {
            href: `https://www.zhipin.com/job_detail/${item.jobId}.html`, target: "_blank", rel: "noopener", textContent: "打开",
            title: "不在当前页，打开岗位页手动沟通",
          });
        }
        action.className = "zdl-remedy-action";
        row.append(box, names, action);
        listWrap.appendChild(row);
      });
      updateFooter();
    };

    const close = () => {
      panel.remove();
      document.removeEventListener("click", closeOnOutside, true);
      document.removeEventListener("keydown", onEsc, true);
    };
    const closeOnOutside = (e) => {
      if (!e.isTrusted || panel.contains(e.target) || e.target === elements.remedyBtn) return;
      if (document.getElementById("boss-pro-panel")?.contains(e.target)) return;
      close();
    };
    const onEsc = (e) => { if (e.key === "Escape") close(); };
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); });
    setTimeout(() => {
      document.addEventListener("click", closeOnOutside, true);
      document.addEventListener("keydown", onEsc, true);
    }, 0);

    panel.append(header, hint, listWrap, footer);
    render();

    // 放在主面板左边，放不下就放右边
    const mainPanel = document.getElementById("boss-pro-panel");
    if (mainPanel && mainPanel.style.display !== "none") {
      const rect = mainPanel.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 24);
      let left = rect.left - width - 12;
      if (left < 12) left = rect.right + 12;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      const top = Math.max(12, Math.min(rect.top, window.innerHeight - 120));
      Object.assign(panel.style, {
        top: `${top}px`, left: `${left}px`, right: "auto", width: `${width}px`,
        maxHeight: `${Math.max(160, Math.min(560, window.innerHeight - top - 12))}px`,
      });
    }
    document.body.appendChild(panel);
    this._makeDraggable(panel);
  },
};
