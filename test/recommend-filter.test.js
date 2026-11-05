import test from "node:test";
import assert from "node:assert/strict";
import { normalizeJobTypeFilter } from "../src/rules/job-type.js";
import { describeRecommendFilters, recommendFilters } from "../src/rules/recommend-filter.js";

const pick = (value) => recommendFilters(normalizeJobTypeFilter(value));

test("不限岗位类型时「推荐」的筛选都不动", () => {
  assert.deepEqual(pick(null), { jobType: [], experience: [] });
  assert.equal(describeRecommendFilters(pick(null)), "");
});

test("只投实习：求职类型选实习，经验选实习岗常见的几档", () => {
  assert.deepEqual(pick({ types: ["intern"] }), {
    jobType: ["实习"], experience: ["在校生", "应届生", "经验不限", "1年以内"],
  });
});

test("校招：求职类型全职，经验选在校/应届/经验不限；设了学历也不选学历（会筛掉学历不限的岗位）", () => {
  const result = pick({ types: ["campus"], degree: "bachelor" });
  assert.deepEqual(result, { jobType: ["全职"], experience: ["在校生", "应届生", "经验不限"] });
  assert.equal(describeRecommendFilters(result), "求职类型 全职 · 工作经验 在校生/应届生/经验不限");
});

test("实习+校招：求职类型不限，经验合并两类", () => {
  const result = pick({ types: ["intern", "campus"] });
  assert.deepEqual(result.jobType, []);
  assert.deepEqual(result.experience, ["在校生", "应届生", "经验不限", "1年以内"]);
});

test("社招按所选年限选经验；年限全选时经验不限", () => {
  const result = pick({ types: ["social"], years: ["y1_3", "y5p"] });
  assert.deepEqual(result.jobType, ["全职"]);
  assert.deepEqual(result.experience, ["经验不限", "1-3年", "5-10年", "10年以上"]);
  assert.deepEqual(pick({ types: ["campus", "social"] }).experience, []);
});
