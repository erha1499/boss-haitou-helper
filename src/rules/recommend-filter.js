// 「推荐」栏目按用户定位列岗位，不相关的很多。投「推荐」前按岗位类型设置帮用户选好 BOSS 自带的筛选条件，
// 让列表里能投的岗位多一些。只在条件明确时才选，拿不准的保持“不限”，剩下的交给脚本自己的规则。
// 薪资不设：BOSS 的薪资档位和脚本按岗位类型分开的薪资规则对不上。
// 学历不设：BOSS 选了学历就只列出写着这些学历的岗位，“学历不限”的岗位会被筛掉，交给脚本自己判断。

// BOSS 下拉框里的选项文字
export const REC_EXPERIENCE = ["在校生", "应届生", "经验不限", "1年以内", "1-3年", "3-5年", "5-10年", "10年以上"];
const YEARS_OPTIONS = { y0_1: ["1年以内"], y1_3: ["1-3年"], y3_5: ["3-5年"], y5p: ["5-10年", "10年以上"], none: [] };

// filter 为 normalizeJobTypeFilter 的结果。返回要选的选项文字，空数组表示不限：
// { jobType: [] | ["实习"] | ["全职"], experience: [...] }
export function recommendFilters({ types, years }) {
  const intern = types.includes("intern");
  const campus = types.includes("campus");
  const social = types.includes("social");
  // 求职类型是单选：只投实习选“实习”，不投实习选“全职”，都投就不限
  const jobType = intern && !campus && !social ? ["实习"] : !intern && types.length ? ["全职"] : [];

  // 工作经验多选。“经验不限”的岗位脚本总会收集，所以总要带上
  const exp = new Set(["经验不限"]);
  // 实习岗的经验一栏常写“在校/应届”，也有写“1年以内”的
  if (intern) ["在校生", "应届生", "1年以内"].forEach((x) => exp.add(x));
  if (campus) ["在校生", "应届生"].forEach((x) => exp.add(x));
  if (social) years.forEach((y) => (YEARS_OPTIONS[y] || []).forEach((x) => exp.add(x)));
  const experience = !types.length || exp.size >= REC_EXPERIENCE.length ? [] : REC_EXPERIENCE.filter((x) => exp.has(x));
  return { jobType, experience };
}

// 日志里的说明，比如“求职类型 实习 · 工作经验 在校生/应届生/经验不限/1年以内”
export function describeRecommendFilters({ jobType, experience }) {
  return [
    jobType.length ? `求职类型 ${jobType.join("/")}` : "",
    experience.length ? `工作经验 ${experience.join("/")}` : "",
  ].filter(Boolean).join(" · ");
}
