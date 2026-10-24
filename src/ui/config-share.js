import { CONFIG_STORAGE_KEYS, canUndoConfigImport, configExternalChanged, exportConfig, getConfigChanges, getConfigUndo, getCurrentConfig, importConfig, parseConfig, undoConfigImport } from "../settings-store.js";
import { elements, state } from "../state.js";
import { UI_ICONS } from "./icons.js";

export const ConfigShareMethods = {
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
