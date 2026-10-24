import { isJobsPage } from "./config.js";
import { Core, stopProcess } from "./core.js";
import { elements, state } from "./state.js";
import { UI_ICONS } from "./ui/icons.js";
import { UI } from "./ui/index.js";

export const DELIVERY_STATS_KEY = "zdlDeliveryStatsV1";
export const CURRENT_ACCOUNT_KEY = "zdlAccountPageV1:";
export const DELIVERY_LOCK_NAME = "zdl-boss-delivery";
export const Delivery = {
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
