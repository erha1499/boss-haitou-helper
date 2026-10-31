import test from "node:test";
import assert from "node:assert/strict";
import { explainCoarse } from "../src/rules/coarse.js";
import { normalizeJobTypeFilter } from "../src/rules/job-type.js";
import { normalizeSalaryFilter } from "../src/rules/salary.js";

const noRules = {
  blockedCompanies: [], coarseBlockedTags: [], coarseRequiredTags: [], includeTags: [], locationTags: [],
  salaryFilter: normalizeSalaryFilter(null),
  jobTypeFilter: normalizeJobTypeFilter(null),
};
const card = (extra = {}) => ({ jobId: "j1", title: "Java后端开发", company: "某某科技", address: "杭州·西湖区", salary: "15-25K", headhunter: false, tags: [], ...extra });
const reason = (info, rules = {}, contacted) => explainCoarse(info, contacted, { ...noRules, ...rules }).reason;

test("没有规则时都收集", () => {
  assert.equal(reason(card()), "");
});

test("已沟通过、猎头岗位默认跳过", () => {
  assert.equal(reason(card(), {}, new Set(["j1"])), "contacted");
  assert.equal(reason(card({ headhunter: true })), "headhunter");
});

test("排除公司和职位名排除词", () => {
  assert.equal(reason(card(), { blockedCompanies: ["某某"] }), "company");
  assert.equal(reason(card(), { coarseBlockedTags: ["后端"] }), "blocked");
});

test("必须包含：每个词都要命中", () => {
  assert.equal(reason(card(), { coarseRequiredTags: ["java", "后端"] }), "");
  assert.equal(reason(card(), { coarseRequiredTags: ["java", "golang"] }), "required");
});

test("包含任一：命中一个就行", () => {
  assert.equal(reason(card(), { includeTags: ["前端", "java"] }), "");
  assert.equal(reason(card(), { includeTags: ["前端", "测试"] }), "optional");
});

test("工作地", () => {
  assert.equal(reason(card(), { locationTags: ["杭州"] }), "");
  assert.equal(reason(card(), { locationTags: ["北京", "上海"] }), "location");
});

test("薪资", () => {
  assert.equal(reason(card(), { salaryFilter: { campus: { min: "30" }, social: { min: "30" } } }), "salary");
  const label = explainCoarse(card({ salary: "面议" }), null, { ...noRules, salaryFilter: { negotiable: false } }).label;
  assert.equal(label, "薪资面议");
});

test("卡片写明年限且不在范围内时，列表阶段就排除", () => {
  const internOnly = normalizeJobTypeFilter({ types: ["intern"] });
  const result = explainCoarse(card({ tags: ["3-5年"] }), null, { ...noRules, jobTypeFilter: internOnly });
  assert.equal(result.reason, "jobtype");
  assert.equal(result.label, '经验要求"3-5年"');
  // 没写年限的留到详情再判断
  assert.equal(reason(card(), { jobTypeFilter: internOnly }), "");
});

test("判断顺序：排除公司优先于其他规则", () => {
  assert.equal(reason(card(), { blockedCompanies: ["某某"], coarseBlockedTags: ["后端"], locationTags: ["北京"] }), "company");
});

test("学历：选了的学历及以下才收集，岗位没写学历的照常收集", () => {
  const master = normalizeJobTypeFilter({ types: ["intern", "campus"], degree: "master" });
  const bachelor = normalizeJobTypeFilter({ types: ["intern", "campus"], degree: "bachelor" });
  const doctorRole = card({ title: "算法实习生", tags: ["在校/应届", "博士"] });
  assert.equal(reason(doctorRole, { jobTypeFilter: master }), "degree");
  assert.equal(explainCoarse(doctorRole, null, { ...noRules, jobTypeFilter: master }).label, '学历要求"博士"');
  assert.equal(reason(card({ tags: ["在校/应届", "硕士"] }), { jobTypeFilter: master }), "");
  assert.equal(reason(card({ tags: ["在校/应届", "硕士"] }), { jobTypeFilter: bachelor }), "degree");
  assert.equal(reason(card({ tags: ["在校/应届", "本科"] }), { jobTypeFilter: bachelor }), "");
  assert.equal(reason(card({ tags: ["在校/应届", "学历不限"] }), { jobTypeFilter: bachelor }), "");
  assert.equal(reason(card({ tags: ["在校/应届"] }), { jobTypeFilter: bachelor }), "");
});

test("没选实习/校招时学历不生效", () => {
  const socialOnly = normalizeJobTypeFilter({ types: ["social"], degree: "bachelor" });
  assert.equal(reason(card({ tags: ["博士"] }), { jobTypeFilter: socialOnly }), "");
});

test("实习、校招、社招的薪资分开筛选", () => {
  const salaryFilter = normalizeSalaryFilter({ intern: { min: "200" }, campus: { min: "15" }, social: { min: "25" } });
  // 实习：按日薪
  assert.equal(reason(card({ title: "后端实习生", salary: "150-180元/天" }), { salaryFilter }), "salary");
  assert.equal(reason(card({ title: "后端实习生", salary: "200-300元/天" }), { salaryFilter }), "");
  // 校招：按月薪 K
  assert.equal(reason(card({ tags: ["在校/应届"], salary: "10-12K" }), { salaryFilter }), "salary");
  assert.equal(reason(card({ tags: ["在校/应届"], salary: "12-18K" }), { salaryFilter }), "");
  // 社招（写明年限）：用社招档
  assert.equal(reason(card({ tags: ["3-5年"], salary: "15-20K" }), { salaryFilter }), "salary");
  assert.equal(reason(card({ tags: ["3-5年"], salary: "20-30K" }), { salaryFilter }), "");
});
