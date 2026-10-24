import test from "node:test";
import assert from "node:assert/strict";
import { RECRUITER_STATUS_OPTIONS } from "../src/config.js";
import { matchKeyword } from "../src/rules/keywords.js";
import { WIZARD_DIRECTIONS, WIZARD_NON_TECH, WIZARD_STACKS, generateWizardConfig, wizardKeywordName } from "../src/rules/wizard.js";

const signature = (key) => WIZARD_DIRECTIONS.find((d) => d.key === key).signature;

test("选中的方向和技术栈写进包含词", () => {
  const config = generateWizardConfig({ directions: ["backend"], stacks: ["java"] });
  assert.ok(config.includeTags.includes(WIZARD_DIRECTIONS.find((d) => d.key === "backend").include));
  assert.ok(config.includeTags.includes("java"));
  assert.deepEqual(config.detailOptionalTags, [WIZARD_STACKS.find((s) => s.key === "java").jd]);
});

test("没选中的方向写进职位名排除，选中的不排除", () => {
  const blocked = generateWizardConfig({ directions: ["backend"] }).coarseBlockedTags;
  assert.ok(blocked.includes(signature("frontend")));
  assert.ok(blocked.includes(signature("testing")));
  assert.ok(!blocked.includes(signature("backend")));
  assert.ok(blocked.includes(WIZARD_NON_TECH));
});

test("全栈、AI 应用不排除后端", () => {
  assert.ok(!generateWizardConfig({ directions: ["fullstack"] }).coarseBlockedTags.includes(signature("backend")));
  assert.ok(!generateWizardConfig({ directions: ["ai"] }).coarseBlockedTags.includes(signature("backend")));
  assert.ok(!generateWizardConfig({ directions: ["fullstack"] }).coarseBlockedTags.includes(signature("frontend")));
});

test("只选后端时，排除词挡掉前端岗，不挡后端岗", () => {
  const blocked = generateWizardConfig({ directions: ["backend"] }).coarseBlockedTags;
  const isBlocked = (title) => blocked.some((kw) => matchKeyword(title.toLowerCase(), kw));
  assert.equal(isBlocked("Java后端开发"), false);
  assert.equal(isBlocked("Web前端开发"), true);
  assert.equal(isBlocked("测试开发工程师"), true);
  assert.equal(isBlocked("销售代表"), true);
});

test("岗位类型、薪资、招聘者", () => {
  const config = generateWizardConfig({ identities: ["intern"], minSalary: "8", onlyHr: true, recentActive: false });
  assert.deepEqual(config.jobTypeFilter.types, ["intern", "open"]);
  assert.deepEqual(config.salaryFilter, { type: "atLeast", min: "8", max: "", negotiable: true });
  assert.deepEqual(config.recruiterIncludeTags, ["hr*|招聘|人事"]);
  assert.deepEqual(config.recruiterActivityStatus, RECRUITER_STATUS_OPTIONS);
});

test("社招按经验年限上限生成", () => {
  const config = generateWizardConfig({ identities: ["social"], includeOpen: false, maxYears: "3" });
  assert.deepEqual(config.jobTypeFilter, { types: ["social"], years: ["y0_1", "y1_3", "none"] });
});

test("向导里的关键词都是合法正则", () => {
  const all = [
    ...WIZARD_DIRECTIONS.flatMap((d) => [d.include, d.signature].filter(Boolean)),
    ...WIZARD_STACKS.flatMap((s) => [s.title, s.jd]),
    WIZARD_NON_TECH,
  ];
  for (const kw of all) {
    // 末尾 * 是脚本自己的前缀写法，去掉后应是合法正则
    const source = kw.split("|").map((part) => part.replace(/([a-z0-9])\*$/i, "$1")).join("|");
    assert.doesNotThrow(() => new RegExp(source), kw);
  }
});

test("向导生成的多写法关键词都有名字，改过的没有", () => {
  const config = generateWizardConfig({ directions: ["backend", "ai"], stacks: ["java", "go"], onlyHr: true });
  const keywords = [...config.includeTags, ...config.coarseBlockedTags, ...config.detailOptionalTags, ...config.recruiterIncludeTags];
  for (const keyword of keywords.filter((k) => k.includes("|"))) assert.ok(wizardKeywordName(keyword), keyword);
  assert.equal(wizardKeywordName(WIZARD_DIRECTIONS[0].include), "后端方向");
  assert.equal(wizardKeywordName(WIZARD_NON_TECH), "非技术岗（销售、客服、运营等）");
  assert.equal(wizardKeywordName(`${WIZARD_DIRECTIONS[0].include}|新加的词`), "");
  assert.equal(wizardKeywordName("java"), "");
});

