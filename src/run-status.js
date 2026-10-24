import { elements, state } from "./state.js";

// 投递中的状态：面板里“开始投递”下面的状态行，以及网页标签的标题。
// 切到别的标签页时也能从标题看到进度；投递结束后标题提示结果，回到这个页面几秒后恢复。

const TITLE_TAG = /^【[^】]*】/;
let clearTitleTimer = 0;
let clearTitleOnVisible = null;

function setTitleTag(tag) {
  const base = document.title.replace(TITLE_TAG, "");
  document.title = tag ? `【${tag}】${base}` : base;
}

export const RunStatus = {
  activity: "",

  // 正在做什么，比如“正在加载岗位列表…”“正在看：某某科技 · Java开发”
  setActivity(text) {
    this.activity = text;
    this.render();
  },

  render() {
    const el = elements.runStatusEl;
    const run = state.activeRun;
    const running = !!run?.started && state.isRunning;
    if (el) {
      el.hidden = !running;
      if (running) {
        const skipped = Object.values(run.skips).reduce((sum, n) => sum + n, 0);
        el.querySelector(".zdl-run-count").textContent = `本次已投 ${run.delivered} · 跳过 ${skipped}`;
        el.querySelector(".zdl-run-activity").textContent = this.activity;
        el.querySelector(".zdl-run-activity").title = this.activity;
      }
    }
    if (running) {
      this._stopTitleCleanup();
      setTitleTag(`投递中 ${state.delivery.dailyCount}/${state.targetCount}`);
    }
  },

  // 投递结束：result 为“投递完成”“已停止”“投递异常”
  finish(result) {
    this.activity = "";
    this.render();
    setTitleTag(result);
    this._stopTitleCleanup();
    const clearLater = () => {
      clearTitleTimer = setTimeout(() => setTitleTag(""), 8000);
    };
    if (!document.hidden) {
      clearLater();
      return;
    }
    clearTitleOnVisible = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", clearTitleOnVisible);
      clearTitleOnVisible = null;
      clearLater();
    };
    document.addEventListener("visibilitychange", clearTitleOnVisible);
  },

  _stopTitleCleanup() {
    clearTimeout(clearTitleTimer);
    if (clearTitleOnVisible) document.removeEventListener("visibilitychange", clearTitleOnVisible);
    clearTitleOnVisible = null;
  },
};
