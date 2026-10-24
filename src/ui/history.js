import { saveTags } from "../settings-store.js";
import { elements, state } from "../state.js";
import { UI_ICONS } from "./icons.js";
import { renderTagList } from "./settings.js";

export const HistoryMethods = {
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
