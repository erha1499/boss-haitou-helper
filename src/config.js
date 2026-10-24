export const CONFIG = {
  BASIC_INTERVAL: 1000,
  OPERATION_INTERVAL: 1200,
  DAILY_LIMIT: 150,
  WORK_DAYS_PER_MONTH: 24,

  MAX_LOG_ENTRIES: 100,
  DETAIL_TIMEOUT: 8000,
};

export const JOBS_PAGE_URL = "https://www.zhipin.com/web/geek/jobs?ka=header-jobs";
export const REPO_URL = "https://github.com/erha1499/boss-haitou-helper";
export const isJobsPage = () => /^\/web\/geek\/jobs(?:\/|$)/.test(location.pathname);

export const getStoredJSON = (key, defaultValue) => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  } catch (e) {
    console.error(`Error parsing ${key}:`, e);
    return defaultValue;
  }
};

export const RECRUITER_STATUS_OPTIONS = ["在线", "刚刚活跃", "今日活跃", "3日内活跃", "本周活跃", "本月活跃", "半年前活跃", "未知"];
