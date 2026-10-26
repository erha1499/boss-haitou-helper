import test from "node:test";
import assert from "node:assert/strict";
import { explainCoarse } from "../src/rules/coarse.js";
import { normalizeJobTypeFilter } from "../src/rules/job-type.js";

const noRules = {
  blockedCompanies: [], coarseBlockedTags: [], coarseRequiredTags: [], includeTags: [], locationTags: [],
  salaryFilter: { type: "none", min: "", max: "", negotiable: true },
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
  assert.equal(reason(card(), { salaryFilter: { type: "atLeast", min: "30", max: "", negotiable: true } }), "salary");
  const label = explainCoarse(card({ salary: "面议" }), null, { ...noRules, salaryFilter: { type: "none", negotiable: false } }).label;
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
