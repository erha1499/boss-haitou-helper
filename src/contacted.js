import { BOSS } from "./boss/selectors.js";

// 记录各账号已沟通过的岗位 id，下次直接在粗筛阶段跳过，不再逐个点开。
export const CONTACTED_JOBS_KEY = "zdlContactedJobsV1";
export const CONTACTED_JOBS_LIMIT = 3000;
export const ContactedJobs = {
  idOf(card) {
    const href = card.querySelector(BOSS.cardLink)?.getAttribute("href") || "";
    return href.match(/job_detail\/([^./?#]+)/)?.[1] || "";
  },

  _read() {
    try {
      const data = JSON.parse(localStorage.getItem(CONTACTED_JOBS_KEY) || "{}");
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch (error) {
      return {};
    }
  },

  setFor(uid) {
    const ids = this._read()[uid];
    return new Set(Array.isArray(ids) ? ids : []);
  },

  add(uid, jobId) {
    if (!uid || !jobId) return;
    const data = this._read();
    const ids = Array.isArray(data[uid]) ? data[uid] : [];
    if (ids.includes(jobId)) return;
    ids.push(jobId);
    data[uid] = ids.slice(-CONTACTED_JOBS_LIMIT);
    try { localStorage.setItem(CONTACTED_JOBS_KEY, JSON.stringify(data)); } catch (error) {}
  },
};
