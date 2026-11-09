import test from "node:test";
import assert from "node:assert/strict";
import { INDUSTRIES, industryBatches, normalizeIndustries } from "../src/rules/industries.js";

test("行业列表和 BOSS 一致：145 个，没有重名", () => {
  assert.equal(INDUSTRIES.length, 145);
  assert.equal(new Set(INDUSTRIES).size, INDUSTRIES.length);
});

test("按 BOSS 的顺序 3 个一批，不认识的行业丢掉", () => {
  assert.deepEqual(industryBatches([]), []);
  assert.deepEqual(industryBatches(["银行", "游戏", "互联网", "大数据", "乱写的"]), [["互联网", "游戏", "大数据"], ["银行"]]);
  assert.deepEqual(normalizeIndustries(null), []);
});
