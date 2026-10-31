import test from "node:test";
import assert from "node:assert/strict";
import { activeDegree, classifyJob, isJobTypeFilterActive, jobTypeMatches, normalizeJobTypeFilter } from "../src/rules/job-type.js";

const kindOf = (job) => {
  const result = classifyJob(job);
  return result.kind === "years" ? `years:${result.bucket}` : result.kind === "soft" ? result.types.join("+") : "unknown";
};

test("职位名、按天计薪、标签里的实习信号", () => {
  assert.equal(kindOf({ title: "Java开发实习生" }), "intern");
  assert.equal(kindOf({ title: "Software Engineer Intern" }), "intern");
  assert.equal(kindOf({ title: "后端开发", salary: "200-300元/天" }), "intern");
  assert.equal(kindOf({ title: "后端开发", tags: ["4天/周"] }), "intern");
  assert.equal(kindOf({ title: "后端开发", tags: ["6个月"] }), "intern");
});

test("「x个月」标签在写明年限时不算实习", () => {
  assert.equal(kindOf({ title: "后端开发", tags: ["6个月", "1-3年"] }), "years:y1_3");
});

test("校招/应届信号", () => {
  assert.equal(kindOf({ title: "后端开发", tags: ["在校/应届"] }), "campus");
  assert.equal(kindOf({ title: "2027届校招-后端开发" }), "campus");
  assert.equal(kindOf({ title: "管培生" }), "campus");
});

test("实习岗经验写「在校/应届」时按实习处理", () => {
  assert.equal(kindOf({ title: "后端开发实习", tags: ["在校/应届"] }), "intern");
});

test("卡片标签上的年限", () => {
  assert.equal(kindOf({ title: "后端开发", tags: ["1-3年"] }), "years:y1_3");
  assert.equal(kindOf({ title: "后端开发", tags: ["5-10年"] }), "years:y5p");
  assert.equal(kindOf({ title: "后端开发", tags: ["1年以内"] }), "years:y0_1");
  // 卡片“1年以内”对实习岗只是默认值
  assert.equal(kindOf({ title: "后端开发实习", tags: ["1年以内"] }), "intern");
});

test("描述里写明的年限按社招处理，取最高的年限", () => {
  const result = classifyJob({ title: "后端开发", tags: ["经验不限"], desc: "要求3年以上工作经验，熟悉Java" });
  assert.equal(result.kind, "years");
  assert.equal(result.bucket, "y3_5");
  assert.equal(result.label, "社招·3-5年");
  assert.match(result.evidence, /「3年以上工作经验」/);
  assert.equal(kindOf({ title: "后端", desc: "1-3年工作经验；5年以上Java开发经验" }), "years:y5p");
  assert.equal(kindOf({ title: "后端", desc: "两年及以上相关经验" }), "years:y1_3");
  assert.equal(kindOf({ title: "后端", desc: "经验要求：3-5年" }), "years:y3_5");
});

test("加分项不算年限要求", () => {
  assert.equal(kindOf({ title: "后端开发", tags: ["经验不限"], desc: "有2年以上银行项目经验者优先" }), "open");
});

test("候选人的实习经历、否定说法、上限不算年限要求", () => {
  assert.equal(kindOf({ title: "后端开发", desc: "有1年以上实习经验" }), "unknown");
  assert.equal(kindOf({ title: "后端开发", desc: "不要求3年经验" }), "unknown");
  assert.equal(kindOf({ title: "后端开发", desc: "3年以下经验" }), "unknown");
});

test("描述里的实习信号", () => {
  assert.equal(kindOf({ title: "后端开发", desc: "实习期3个月，表现优秀可转正" }), "intern");
  assert.equal(kindOf({ title: "后端开发", desc: "每周至少4天到岗" }), "intern");
});

test("不是实习信号的说法", () => {
  assert.equal(kindOf({ title: "后端开发", desc: "不接受实习生" }), "unknown");
  assert.equal(kindOf({ title: "后端开发", desc: "试用期表现优秀可转正" }), "unknown");
  assert.equal(kindOf({ title: "后端开发", desc: "每周5天，双休" }), "unknown");
});

test("什么都没写时归入未标明", () => {
  const result = classifyJob({ title: "后端开发" });
  assert.equal(result.kind, "unknown");
  assert.equal(result.label, "未标明");
});

test("规范化岗位类型设置", () => {
  const all = normalizeJobTypeFilter(null);
  assert.deepEqual(all.types, ["intern", "campus", "social"]);
  assert.deepEqual(all.years, ["y0_1", "y1_3", "y3_5", "y5p", "none"]);
  // 旧版本的“经验不限/未标明”（open、any、unknown）现在不用选，和未知值一起丢掉；顺序按固定顺序
  assert.deepEqual(normalizeJobTypeFilter({ types: ["unknown", "campus", "open", "intern", "xxx"], years: [] }), { types: ["intern", "campus"], years: [], degree: "" });
});

test("岗位类型是否在投递范围", () => {
  const internOnly = normalizeJobTypeFilter({ types: ["intern"] });
  assert.equal(isJobTypeFilterActive(internOnly), true);
  assert.equal(isJobTypeFilterActive(normalizeJobTypeFilter(null)), false);
  assert.equal(jobTypeMatches(classifyJob({ title: "后端实习" }), internOnly), true);
  assert.equal(jobTypeMatches(classifyJob({ title: "后端", tags: ["1-3年"] }), internOnly), false);
  assert.equal(jobTypeMatches(classifyJob({ title: "后端" }), internOnly), true);

  const social1to3 = normalizeJobTypeFilter({ types: ["social"], years: ["y0_1", "y1_3"] });
  assert.equal(jobTypeMatches(classifyJob({ title: "后端", tags: ["1-3年"] }), social1to3), true);
  assert.equal(jobTypeMatches(classifyJob({ title: "后端", tags: ["3-5年"] }), social1to3), false);
  // 只写了“社招”没写年限，要勾“未写年限”才投
  const socialOnly = classifyJob({ title: "后端", desc: "社招岗位" });
  assert.equal(jobTypeMatches(socialOnly, social1to3), false);
  assert.equal(jobTypeMatches(socialOnly, normalizeJobTypeFilter({ types: ["social"], years: ["none"] })), true);
});

test("描述里单独的“毕业生”不算校招，明确的应届说法才算", () => {
  assert.equal(kindOf({ title: "Java开发工程师", desc: "全日制统招本科及以上毕业生，熟悉Java、Spring" }), "unknown");
  assert.equal(kindOf({ title: "Java开发工程师", tags: ["经验不限"], desc: "统招本科毕业生" }), "open");
  assert.equal(kindOf({ title: "Java开发", desc: "面向2027年毕业生" }), "campus");
  assert.equal(kindOf({ title: "Java开发", desc: "欢迎应届毕业生投递" }), "campus");
  // 职位名里写“毕业生”仍算校招
  assert.equal(kindOf({ title: "2026毕业生-Java开发" }), "campus");
});

test("“指导实习生”这类说法不算实习，招实习生的说法仍算", () => {
  assert.equal(kindOf({ title: "高级Java工程师", desc: "负责核心系统设计，指导实习生和初级工程师" }), "unknown");
  assert.equal(kindOf({ title: "技术经理", desc: "带领新人和实习生完成项目" }), "unknown");
  assert.equal(kindOf({ title: "技术经理", desc: "负责培养实习生" }), "unknown");
  assert.equal(kindOf({ title: "Java开发", desc: "招聘实习生若干名" }), "intern");
  assert.equal(kindOf({ title: "Java开发", desc: "本岗位为实习岗" }), "intern");
});

test("识别英文写的年限要求", () => {
  assert.equal(kindOf({ title: "Backend Engineer", desc: "3+ years of experience with Go" }), "years:y3_5");
  assert.equal(kindOf({ title: "Backend Engineer", desc: "At least 5 years’ professional software development experience." }), "years:y5p");
  assert.equal(kindOf({ title: "Backend Engineer", desc: "2-4 yrs experience in Java" }), "years:y1_3");
  assert.equal(kindOf({ title: "Backend Engineer", desc: "1 year experience" }), "years:y1_3");
  const result = classifyJob({ title: "Backend Engineer", desc: "Requirements: 3+ years of experience with Go" });
  assert.match(result.evidence, /「3\+ years of experience」/);
});

test("英文的实习经历、加分项不算年限要求", () => {
  assert.equal(kindOf({ title: "Backend Engineer", desc: "1 year of internship experience" }), "unknown");
  assert.equal(kindOf({ title: "Backend Engineer", desc: "2+ years of Kubernetes experience is a plus" }), "unknown");
  assert.equal(kindOf({ title: "Backend Engineer", desc: "3 years of experience preferred" }), "unknown");
});

test("没标类型、“经验不限”的岗位不管选了什么类型都照常收集", () => {
  const filters = [["intern"], ["campus"], ["social"]].map((types) => normalizeJobTypeFilter({ types, years: ["y1_3"] }));
  for (const filter of filters) {
    assert.equal(jobTypeMatches(classifyJob({ title: "后端开发" }), filter), true);
    assert.equal(jobTypeMatches(classifyJob({ title: "后端开发", tags: ["经验不限"] }), filter), true);
  }
  // 标了类型、不在范围内的照样跳过
  const internOnly = normalizeJobTypeFilter({ types: ["intern"] });
  assert.equal(jobTypeMatches(classifyJob({ title: "后端开发", tags: ["在校/应届"] }), internOnly), false);
  assert.equal(jobTypeMatches(classifyJob({ title: "后端开发", desc: "要求3年以上工作经验" }), internOnly), false);
});


test("学历规范化与生效条件", () => {
  assert.equal(normalizeJobTypeFilter({ degree: "master" }).degree, "master");
  assert.equal(normalizeJobTypeFilter({ degree: "bogus" }).degree, "");
  // 只选社招时学历不生效
  assert.equal(activeDegree(normalizeJobTypeFilter({ types: ["social"], degree: "master" })), "");
  assert.equal(activeDegree(normalizeJobTypeFilter({ types: ["campus", "social"], degree: "master" })), "master");
  // 类型全选时，只有选了学历才算有筛选
  assert.equal(isJobTypeFilterActive(normalizeJobTypeFilter(null)), false);
  assert.equal(isJobTypeFilterActive(normalizeJobTypeFilter({ degree: "master" })), true);
});
