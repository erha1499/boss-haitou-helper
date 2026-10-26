// 细筛时被规则跳过的岗位：记下来让用户复查，误跳过的可以补投。
// 按账号保存当天的记录，换一天自动清空；同一个岗位只留最新一条。
export const SKIPPED_JOBS_KEY = "zdlSkippedJobsV1";
export const SKIPPED_JOBS_LIMIT = 100;

const today = () => new Date().toLocaleDateString();

export const SkippedJobs = {
  _read() {
    try {
      const data = JSON.parse(localStorage.getItem(SKIPPED_JOBS_KEY) || "{}");
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch (error) {
      return {};
    }
  },

  _write(data) {
    try { localStorage.setItem(SKIPPED_JOBS_KEY, JSON.stringify(data)); } catch (error) {}
  },

  // 当天的记录，最新的在前
  list(uid) {
    const record = this._read()[uid];
    return record?.date === today() && Array.isArray(record.items) ? record.items : [];
  },

  // item：{ jobId, title, company, salary, address, reason }
  add(uid, item) {
    if (!uid || !item.jobId) return;
    const data = this._read();
    const items = this.list(uid).filter((saved) => saved.jobId !== item.jobId);
    data[uid] = { date: today(), items: [{ ...item, at: Date.now() }, ...items].slice(0, SKIPPED_JOBS_LIMIT) };
    this._write(data);
  },

  remove(uid, jobIds) {
    if (!uid || !jobIds.length) return;
    const data = this._read();
    data[uid] = { date: today(), items: this.list(uid).filter((saved) => !jobIds.includes(saved.jobId)) };
    this._write(data);
  },
};
