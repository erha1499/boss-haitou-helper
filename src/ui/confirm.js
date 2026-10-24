// 通用确认框：和导入配置弹窗同样的样式。返回用户点的那个按钮的 value，关闭或按 Esc 返回 null。
export const ConfirmMethods = {
  _confirm({ title, message, actions }) {
    if (this._confirmDialog?.open) return Promise.resolve(null);
    const dialog = document.createElement("dialog");
    dialog.className = "zdl-import-dialog zdl-confirm-dialog";
    dialog.setAttribute("aria-labelledby", "zdl-confirm-title");
    dialog.setAttribute("aria-describedby", "zdl-confirm-message");
    const header = document.createElement("div");
    header.className = "zdl-settings-header";
    const heading = Object.assign(document.createElement("h4"), { id: "zdl-confirm-title", textContent: title });
    header.appendChild(heading);
    const body = Object.assign(document.createElement("p"), { id: "zdl-confirm-message", className: "zdl-confirm-message", textContent: message });
    const footer = document.createElement("div");
    footer.className = "zdl-import-footer";
    dialog.append(header, body, footer);
    this._confirmDialog = dialog;

    return new Promise((resolve) => {
      let result = null;
      actions.forEach(({ label, value, primary }) => {
        const button = this._createTextButton(label, () => {
          result = value;
          dialog.close();
        });
        button.className = `zdl-config-btn${primary ? " zdl-config-primary" : ""}`;
        footer.appendChild(button);
      });
      dialog.addEventListener("close", () => {
        dialog.remove();
        this._confirmDialog = null;
        resolve(result);
      });
      document.body.appendChild(dialog);
      dialog.showModal();
      footer.querySelector(".zdl-config-primary")?.focus();
    });
  },
};
