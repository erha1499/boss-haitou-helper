import { CoarsePreview } from "../preview.js";
import { elements, state } from "../state.js";
import { AccountsMethods } from "./accounts.js";
import { ConfigShareMethods } from "./config-share.js";
import { ConfirmMethods } from "./confirm.js";
import { HistoryMethods } from "./history.js";
import { PanelMethods, minimizePanel } from "./panel.js";
import { SettingsMethods } from "./settings.js";
import { TutorialMethods } from "./tutorial.js";
import { WizardMethods } from "./wizard-dialog.js";

// 界面方法按功能分在 ui/ 下的各个文件里，这里拼成同一个 UI 对象，方法之间照常用 this 互相调用。
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
      if (this._confirmDialog?.contains(e.target)) return;
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
      if (elements.configDialog.open || elements.wizardDialog?.open || this._confirmDialog?.open) return;
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
};

Object.assign(UI, ConfirmMethods, PanelMethods, AccountsMethods, TutorialMethods, SettingsMethods, ConfigShareMethods, WizardMethods, HistoryMethods);
