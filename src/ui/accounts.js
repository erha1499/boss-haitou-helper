import { Delivery } from "../delivery.js";
import { elements, state } from "../state.js";
import { UI_ICONS } from "./icons.js";

export const AccountsMethods = {
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
