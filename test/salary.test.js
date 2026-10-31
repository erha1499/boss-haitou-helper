import test from "node:test";
import assert from "node:assert/strict";
import { decodeSalary, normalizeSalaryFilter, parseDailyRange, parseSalaryRange, salaryInFilter } from "../src/rules/salary.js";

test("解码 BOSS 用私有字体显示的数字", () => {
  assert.equal(decodeSalary("-K"), "10-20K");
  assert.equal(decodeSalary("15-25K"), "15-25K");
});

test("解析月薪", () => {
  assert.deepEqual(parseSalaryRange("15-25K·13薪"), { min: 15, max: 25 });
  assert.deepEqual(parseSalaryRange("20K"), { min: 20, max: 20 });
  assert.equal(parseSalaryRange("面议"), null);
});

test("日薪按每月 24 天折算成月薪 K，向上取整", () => {
  assert.deepEqual(parseSalaryRange("200-300元/天"), { min: 5, max: 8 });
  assert.deepEqual(parseSalaryRange("150元/天"), { min: 4, max: 4 });
});

test("薪资区间有重叠就算符合", () => {
  const atLeast10 = { type: "atLeast", min: "10", max: "", negotiable: true };
  assert.equal(salaryInFilter("8-12K", atLeast10), true);
  assert.equal(salaryInFilter("5-8K", atLeast10), false);
  const atMost10 = { type: "atMost", min: "", max: "10", negotiable: true };
  assert.equal(salaryInFilter("12-15K", atMost10), false);
  const range = { type: "range", min: "10", max: "15", negotiable: true };
  assert.equal(salaryInFilter("14-20K", range), true);
  assert.equal(salaryInFilter("16-20K", range), false);
});

test("没设薪资或读不出薪资时不拦截", () => {
  assert.equal(salaryInFilter("5-8K", { type: "none", min: "", max: "", negotiable: true }), true);
  assert.equal(salaryInFilter("薪资保密", { type: "atLeast", min: "10", max: "" }), true);
});

test("面议按「可面议」开关处理", () => {
  const filter = { type: "atLeast", min: "10", max: "" };
  assert.equal(salaryInFilter("面议", { ...filter, negotiable: true }), true);
  assert.equal(salaryInFilter("面议", { ...filter, negotiable: false }), false);
  assert.equal(salaryInFilter("面议", filter), true);
});

test("日薪区间：按天的直接取值，按月的按 24 天折算", () => {
  assert.deepEqual(parseDailyRange("200-300元/天"), { min: 200, max: 300 });
  assert.deepEqual(parseDailyRange("150元/天"), { min: 150, max: 150 });
  assert.deepEqual(parseDailyRange("6-9K"), { min: 250, max: 375 });
  assert.equal(parseDailyRange("面议"), null);
});

test("旧格式的薪资配置沿用到校招和社招，实习不限", () => {
  assert.deepEqual(normalizeSalaryFilter({ type: "range", min: "10", max: "20", negotiable: false }), {
    intern: { min: "", max: "" }, campus: { min: "10", max: "20" }, social: { min: "10", max: "20" }, negotiable: false,
  });
  assert.deepEqual(normalizeSalaryFilter({ type: "none", min: "5", max: "" }).campus, { min: "", max: "" });
  assert.deepEqual(normalizeSalaryFilter(null).social, { min: "", max: "" });
});

test("没标类型的岗位，校招、社招任一档符合就收集", () => {
  const sf = normalizeSalaryFilter({ campus: { min: "20" }, social: { min: "30" } });
  assert.equal(salaryInFilter("20-25K", sf, { kind: "unknown" }), true);
  assert.equal(salaryInFilter("10-15K", sf, { kind: "unknown" }), false);
  assert.equal(salaryInFilter("20-25K", sf, { kind: "years", bucket: "y3_5" }), false);
});
