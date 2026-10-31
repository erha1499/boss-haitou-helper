import { JOB_YEARS_LABEL, classifyJob, degreeRejectBy, isJobTypeFilterActive, jobTypeMatches } from "./job-type.js";
import { matchKeyword } from "./keywords.js";
import { isNegotiableSalary, salaryInFilter } from "./salary.js";

// 粗筛阶段只能看卡片：只有写明年限且不在范围内才排除，其余留到详情再判断
export function coarseJobTypeRejectBy(info, jobTypeFilter) {
  if (!isJobTypeFilterActive(jobTypeFilter)) return null;
  const result = classifyJob({ title: info.title, tags: info.tags, salary: info.salary });
  return result.kind === "years" && !jobTypeMatches(result, jobTypeFilter) ? result : null;
}

// 粗筛：返回不收集的原因（reason 为空表示通过）和给人看的说明。预览和实际投递共用这一份判断。
// rules 里的字段名和 state 一致：blockedCompanies、coarseBlockedTags、coarseRequiredTags、
// includeTags、locationTags、salaryFilter、jobTypeFilter。
export function explainCoarse(info, contacted, rules) {
  if (info.jobId && contacted?.has(info.jobId)) return { reason: "contacted", label: "已沟通过" };
  if (info.headhunter) return { reason: "headhunter", label: "猎头岗位" };
  const title = info.title.toLowerCase();
  const company = info.company.toLowerCase();
  const address = info.address.toLowerCase();
  let kw = rules.blockedCompanies.find((k) => matchKeyword(company, k));
  if (kw) return { reason: "company", label: `排除公司"${kw}"` };
  kw = rules.coarseBlockedTags.find((k) => matchKeyword(title, k));
  if (kw) return { reason: "blocked", label: `职位名排除"${kw}"` };
  kw = rules.coarseRequiredTags.find((k) => !matchKeyword(title, k));
  if (kw) return { reason: "required", label: `缺少必须词"${kw}"` };
  if (rules.includeTags.length && !rules.includeTags.some((k) => matchKeyword(title, k))) {
    return { reason: "optional", label: "未命中任一包含词" };
  }
  if (rules.locationTags.length && !rules.locationTags.some((k) => matchKeyword(address, k))) {
    return { reason: "location", label: "工作地不符" };
  }
  const classified = classifyJob({ title: info.title, tags: info.tags, salary: info.salary });
  if (!salaryInFilter(info.salary, rules.salaryFilter, classified)) {
    return { reason: "salary", label: isNegotiableSalary(info.salary) ? "薪资面议" : "薪资不符" };
  }
  const degree = degreeRejectBy(info.tags, rules.jobTypeFilter);
  if (degree) return { reason: "degree", label: `学历要求"${degree}"` };
  const jobType = coarseJobTypeRejectBy(info, rules.jobTypeFilter);
  if (jobType) return { reason: "jobtype", label: `经验要求"${JOB_YEARS_LABEL[jobType.bucket]}"` };
  return { reason: "", label: "" };
}
