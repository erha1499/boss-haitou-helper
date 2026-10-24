import test from "node:test";
import assert from "node:assert/strict";
import { checkJobCards, createStreakGuard } from "../src/boss/self-check.js";

const info = (extra = {}) => ({ jobId: "j1", title: "Java后端", company: "某某科技", salary: "15-25K", ...extra });

test("列表正常时通过", () => {
  assert.deepEqual(checkJobCards([info(), info()]), { errors: [], warnings: [] });
});

test("没有卡片、读不到职位名时不启动", () => {
  assert.equal(checkJobCards([]).errors.length, 1);
  assert.equal(checkJobCards([info({ title: "" }), info({ title: "" })]).errors.length, 1);
});

test("只有部分卡片缺字段时不算异常", () => {
  assert.deepEqual(checkJobCards([info({ title: "", company: "" }), info()]), { errors: [], warnings: [] });
});

test("读不到次要字段时只提醒", () => {
  const { errors, warnings } = checkJobCards([info({ jobId: "", company: "", salary: "" })]);
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 3);
});

test("同一步连续失败 3 次才停，中间成功一次就重新计数", () => {
  const guard = createStreakGuard();
  assert.equal(guard.fail("detail"), false);
  assert.equal(guard.fail("detail"), false);
  guard.ok("detail");
  assert.equal(guard.fail("detail"), false);
  assert.equal(guard.fail("chat"), false);
  assert.equal(guard.fail("detail"), false);
  assert.equal(guard.fail("detail"), true);
});
