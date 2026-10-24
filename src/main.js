import { JOBS_PAGE_URL, isJobsPage } from "./config.js";
import { Core } from "./core.js";
import { CURRENT_ACCOUNT_KEY, DELIVERY_STATS_KEY, Delivery } from "./delivery.js";
import { CONFIG_STORAGE_KEYS, CONFIG_UNDO_KEY, markConfigExternalChanged } from "./settings-store.js";
import { saveLogEntries, state } from "./state.js";
import { injectCSS } from "./styles.js";
import { SVG_ICON } from "./ui/icons.js";
import { UI } from "./ui/index.js";
import { showNotification } from "./ui/notify.js";

async function init() {
  try {
    const today = new Date().toLocaleDateString();
    if (state.logDate !== today) {
      state.logDate = today;
      state.logEntries = [];
      localStorage.setItem("zdlLogDate", today);
      saveLogEntries();
    }
    injectCSS();
    UI.init();
    Delivery.sync();
    window.addEventListener("storage", (event) => {
      if (event.key === DELIVERY_STATS_KEY || event.key?.startsWith(CURRENT_ACCOUNT_KEY) || event.key === null) Delivery.sync();
      if (event.key === null || CONFIG_STORAGE_KEYS.includes(event.key)) markConfigExternalChanged();
      if (event.key === null || CONFIG_STORAGE_KEYS.includes(event.key) || event.key === CONFIG_UNDO_KEY) UI._updateConfigControls();
    });
    window.addEventListener("focus", () => Delivery.sync());
    setInterval(() => { if (!document.hidden) Delivery.sync(); }, 1500);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) Delivery.sync(); });
    // 恢复持久化的日志条目到 DOM
    const hasHistory = state.logEntries.length > 0;
    const logPanel = document.querySelector("#pro-log");
    if (logPanel && hasHistory) {
      state.logEntries.forEach((entry) => {
        logPanel.appendChild(Core.renderLogItem(entry));
      });
      logPanel.scrollTop = logPanel.scrollHeight;
    }
    if (!hasHistory) {
      Core.log('欢迎使用海投助手，设置好筛选条件后点击"开始投递"');
    }
    try {
      UI.showTutorialIfNeeded();
    } catch (error) {
      console.warn("新手教程初始化失败:", error);
    }
  } catch (error) {
    console.error("初始化失败:", error);
    showNotification("初始化失败", "error");
  }
}

// 非职位页只显示一个入口卡片，引导首次安装的用户找到脚本。
const ENTRY_DISMISSED_KEY = "zdlEntryDismissed";
const EntryGuide = {
  el: null,

  show() {
    if (this.el?.isConnected) return;
    try {
      if (sessionStorage.getItem(ENTRY_DISMISSED_KEY) === "1") return;
    } catch (error) {}
    const wrap = document.createElement("div");
    wrap.className = "zdl-entry";
    wrap.setAttribute("role", "complementary");
    wrap.setAttribute("aria-label", "海投助手入口");
    const head = document.createElement("div");
    head.className = "zdl-entry-head";
    head.innerHTML = `<span class="zdl-entry-icon">${SVG_ICON}</span>
        <span class="zdl-entry-text"><strong>海投助手已就绪</strong><span>需要在「职位」页使用</span></span>`;
    const link = document.createElement("a");
    link.className = "zdl-entry-link";
    link.href = JOBS_PAGE_URL;
    link.textContent = "前往职位页开始投递 →";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "zdl-entry-close";
    close.textContent = "×";
    close.title = "本次不再显示";
    close.setAttribute("aria-label", "关闭海投助手入口");
    close.addEventListener("click", () => {
      try { sessionStorage.setItem(ENTRY_DISMISSED_KEY, "1"); } catch (error) {}
      this.hide();
    });
    head.appendChild(close);
    wrap.append(head, link);
    document.body.appendChild(wrap);
    this.el = wrap;
  },

  hide() {
    this.el?.remove();
    this.el = null;
  },
};

let appStarted = false;

function syncRoute() {
  if (isJobsPage()) {
    EntryGuide.hide();
    if (!appStarted) {
      appStarted = true;
      init();
    }
  } else if (!appStarted) {
    EntryGuide.show();
  }
  if (appStarted) Delivery.render();
}

function boot() {
  try {
    injectCSS();
    UI._applyTheme();
    syncRoute();
  } catch (error) {
    console.error("海投助手启动失败:", error);
  }
  // BOSS 站内是单页跳转，路径变化不会重新加载脚本。
  let lastPath = location.pathname;
  const onRouteChange = () => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    syncRoute();
  };
  window.addEventListener("popstate", onRouteChange);
  setInterval(onRouteChange, 1000);
}

// 部分脚本管理器在 load 之后才注入脚本，此时直接启动。
if (document.readyState === "complete") boot();
else window.addEventListener("load", boot, { once: true });
