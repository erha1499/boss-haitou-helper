// 页面自检：BOSS 改版后选择器可能失效，这时脚本会静默跳过所有岗位，或者一直点沟通却不计数。
// 这里在开始投递前检查职位列表，并在投递中发现连续卡在同一步时停下来。

const FEEDBACK = "如果页面看起来正常，可能是 BOSS 改版了，请到 GitHub 反馈";

// 开始投递前：用列表前几个卡片读出的信息判断页面结构是否还认得。
// infos 为 readCardInfo 的结果数组。errors 不为空时不启动；warnings 只在日志里提醒。
export function checkJobCards(infos) {
  if (!infos.length) {
    return { errors: [`当前页没有找到职位卡片。请等列表加载出来后再开始；${FEEDBACK}`], warnings: [] };
  }
  const none = (field) => infos.every((info) => !info[field]);
  const errors = [];
  const warnings = [];
  if (none("title")) errors.push(`读不到职位名，无法按规则筛选。${FEEDBACK}`);
  if (none("jobId")) warnings.push("读不到岗位链接，已沟通过的岗位可能会被重复点开");
  if (none("company")) warnings.push("读不到公司名，「排除公司」暂时不生效");
  if (none("salary")) warnings.push("读不到薪资，薪资筛选暂时不生效");
  return { errors, warnings };
}

// 投递中：同一步连续失败到 limit 次就该停下来。某一步成功一次，该步的计数清零。
export const STREAK_LIMIT = 3;
export const STREAK_MESSAGES = {
  detail: "连续 3 个岗位详情加载超时",
  chat: "连续 3 个岗位找不到沟通按钮",
  confirm: "连续 3 次点了沟通，但没有确认投递成功",
};

export function createStreakGuard(limit = STREAK_LIMIT) {
  const counts = {};
  return {
    // 返回 true 表示已连续失败到上限
    fail(step) {
      counts[step] = (counts[step] || 0) + 1;
      return counts[step] >= limit;
    },
    ok(step) {
      counts[step] = 0;
    },
  };
}

export const streakStopMessage = (step) =>
  `页面检查异常：${STREAK_MESSAGES[step]}，已自动停止。可能是网络问题，也可能是 BOSS 改版了；确认页面正常后可重新开始，一直出现请到 GitHub 反馈`;
