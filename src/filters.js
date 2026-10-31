import { BOSS } from "./boss/selectors.js";
import { ContactedJobs } from "./contacted.js";
import { coarseJobTypeRejectBy, explainCoarse } from "./rules/coarse.js";
import { isJobTypeFilterActive, jobTypeMatches } from "./rules/job-type.js";
import { decodeSalary } from "./rules/salary.js";
import { state } from "./state.js";

export function readCardInfo(card) {
  return {
    jobId: ContactedJobs.idOf(card),
    title: card.querySelector(BOSS.cardTitle)?.textContent?.trim() || "",
    company: card.querySelector(BOSS.cardCompany)?.textContent?.trim() || "",
    address: (BOSS.cardAddress.map((selector) => card.querySelector(selector)?.textContent).find(Boolean) || "").trim(),
    salary: decodeSalary(card.querySelector(BOSS.cardSalary)?.textContent?.trim() || ""),
    logo: card.querySelector(BOSS.cardLogo)?.src || "",
    headhunter: (card.querySelector(BOSS.cardBadgeIcon)?.alt || "").includes("猎头"),
    tags: Array.from(card.querySelectorAll(BOSS.cardTags), (li) => li.textContent.trim()).filter(Boolean),
  };
}

// 下面这些按当前筛选设置（state）判断，具体规则在 rules/ 里，方便单独测试。
export const coarseExplain = (info, contacted) => explainCoarse(info, contacted, state);
export const coarseRejectReason = (info, contacted) => coarseExplain(info, contacted).reason;
export const jobTypeFilterActive = () => isJobTypeFilterActive(state.jobTypeFilter);
export const jobTypeAccepted = (result) => jobTypeMatches(result, state.jobTypeFilter);
export const coarseJobTypeReject = (info) => coarseJobTypeRejectBy(info, state.jobTypeFilter);

export const hasFilterRules = () => state.includeTags.length || state.coarseBlockedTags.length || state.coarseRequiredTags.length
  || state.detailOptionalTags.length || state.detailRequiredTags.length || state.detailBlockedTags.length
  || state.locationTags.length || state.blockedCompanies.length || state.recruiterIncludeTags.length || jobTypeFilterActive();
