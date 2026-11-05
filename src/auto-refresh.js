// 列表投完但还没到今日目标时，刷新页面换一批岗位接着投。
// 刷新前把进度存在 sessionStorage（只在这个标签页有效），刷新后自动继续。
// 已打开详情判断过的岗位记在 seen 里，刷新后同一套规则下不再重复打开。

const KEY = "zdlAutoRefreshV1";
// 连续这么多次刷新都没投出岗位就停下，避免一直空刷
export const MAX_EMPTY_REFRESHES = 3;
const MAX_REFRESHES = 30;
const MAX_SEEN = 3000;
// 刷新后超过这个时间还没接上就不再自动继续（比如用户隔了很久才手动刷新）
const RESUME_WINDOW_MS = 2 * 60 * 1000;

export const AutoRefresh = {
  read() {
    try {
      const data = JSON.parse(sessionStorage.getItem(KEY) || "null");
      return data && typeof data === "object" && Array.isArray(data.seen) ? data : null;
    } catch (error) {
      return null;
    }
  },

  _write(data) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  },

  clear() {
    try { sessionStorage.removeItem(KEY); } catch (error) {}
  },

  // 刷新后要接着投的进度：账号一致、刚刚刷新过才返回
  pending(uid) {
    const chain = this.read();
    if (!chain?.resumeAt || chain.uid !== uid || Date.now() - chain.resumeAt > RESUME_WINDOW_MS) return null;
    return chain;
  },

  // 接上后去掉待继续标记，之后用户自己刷新页面不会再自动开始
  markResumed(chain) {
    this._write({ ...chain, resumeAt: 0 });
  },

  // 列表投完时调用：能刷新就记下进度并返回本次刷新的信息，不该再刷新时返回 null。
  plan(run, rules) {
    const prev = run.chain || {};
    const pageDelivered = run.delivered - (run.chainDelivered || 0);
    const empty = pageDelivered > 0 ? 0 : (prev.empty || 0) + 1;
    const refreshes = (prev.refreshes || 0) + 1;
    if (empty > MAX_EMPTY_REFRESHES || refreshes > MAX_REFRESHES) return { stop: empty > MAX_EMPTY_REFRESHES ? "empty" : "max" };
    const chain = {
      uid: run.uid, rules, refreshes, empty, resumeAt: Date.now(),
      delivered: run.delivered, skips: run.skips,
      // 从哪个求职意向开始投的（空表示从「推荐」开始），刷新后按同一个起点重新来一遍
      startTab: run.tabs?.startTab || "",
      seen: [...run.seen].slice(-MAX_SEEN),
    };
    return this._write(chain) ? { refreshes } : { stop: "storage" };
  },
};
