import test from "node:test";
import assert from "node:assert/strict";
import { decodeSalary, parseSalaryRange, salaryInFilter } from "../src/rules/salary.js";

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
