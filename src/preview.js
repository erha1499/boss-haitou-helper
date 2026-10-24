import { BOSS } from "./boss/selectors.js";
import { isJobsPage } from "./config.js";
import { ContactedJobs } from "./contacted.js";
import { coarseExplain, readCardInfo } from "./filters.js";
import { JOB_SIGNAL_LABEL, classifyJob } from "./rules/job-type.js";
import { matchKeyword } from "./rules/keywords.js";
import { elements, state } from "./state.js";

// 筛选设置里的实时预览：用当前页已加载的岗位卡片试跑粗筛，不点开岗位、不消耗投递次数。
export const CoarsePreview = {
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
