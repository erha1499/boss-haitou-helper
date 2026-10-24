// 投递主流程：在假的 BOSS 职位页上运行构建好的脚本，从点“开始投递”一直到结束。
import test from "node:test";
import assert from "node:assert/strict";
import { job, openFakeBoss } from "./support/fake-boss.js";

const hasLog = (lines, pattern) => lines.some((line) => pattern.test(line));

test("按今日目标投递，记下次数和已沟通的岗位", async () => {
  const page = await openFakeBoss({ jobs: [1, 2, 3, 4].map((i) => job(i)), storage: { zdlTargetCount: "2" } });
  try {
    const lines = await page.run();
    assert.deepEqual(page.chats, ["job1", "job2"]);
    assert.equal(page.stats().dailyCount, 2);
    assert.deepEqual(page.contacted(), ["job1", "job2"]);
    assert.ok(hasLog(lines, /已达到?今日(投递)?目标/), lines.join("\n"));
    assert.deepEqual(page.errors, []);
  } finally {
    page.close();
  }
});

test("详情命中排除词的跳过，日志里带原文", async () => {
  const jobs = [job(1), job(2, { desc: "本岗位不接受实习生，要求全职" }), job(3)];
  const page = await openFakeBoss({ jobs, storage: { detailBlockedTags: ["不接受实习"] } });
  try {
    const lines = await page.run();
    assert.deepEqual(page.chats, ["job1", "job3"]);
    assert.ok(hasLog(lines, /命中排除词"不接受实习"（本岗位不接受实习生/), lines.join("\n"));
  } finally {
    page.close();
  }
});

test("之前沟通过的岗位跳过并记下来", async () => {
  const page = await openFakeBoss({ jobs: [job(1, { button: "继续沟通" }), job(2)] });
  try {
    const lines = await page.run();
    assert.deepEqual(page.chats, ["job2"]);
    assert.ok(page.contacted().includes("job1"));
    assert.ok(hasLog(lines, /之前已沟通过/), lines.join("\n"));
  } finally {
    page.close();
  }
});

test("遇到 BOSS 150 次上限弹窗时停止，不计数", async () => {
  const page = await openFakeBoss({ jobs: [job(1, { onChat: "limit" }), job(2)] });
  try {
    const lines = await page.run();
    assert.deepEqual(page.chats, ["job1"]);
    assert.equal(page.stats().dailyCount, 0);
    assert.ok(hasLog(lines, /150次上限，自动停止/), lines.join("\n"));
  } finally {
    page.close();
  }
});

test("连续 3 次点了沟通却没确认成功时自动停止", async () => {
  const page = await openFakeBoss({ jobs: [1, 2, 3, 4, 5].map((i) => job(i, { onChat: "none" })) });
  try {
    const lines = await page.run();
    assert.deepEqual(page.chats, ["job1", "job2", "job3"]);
    assert.equal(page.stats().dailyCount, 0);
    assert.ok(hasLog(lines, /连续 3 次点了沟通/), lines.join("\n"));
  } finally {
    page.close();
  }
});

test("连续 3 个详情加载超时时自动停止", async () => {
  const page = await openFakeBoss({ jobs: [1, 2, 3, 4].map((i) => job(i)), detailBroken: true });
  try {
    const lines = await page.run();
    assert.deepEqual(page.chats, []);
    assert.ok(hasLog(lines, /连续 3 个岗位详情加载超时/), lines.join("\n"));
  } finally {
    page.close();
  }
});

test("同一套规则再开始时跳过已判断的岗位；改了规则后重新判断", async () => {
  const jobs = [job(1, { desc: "要求全职，不接受实习" }), job(2, { desc: "要求全职，不接受实习" })];
  const page = await openFakeBoss({ jobs, storage: { detailBlockedTags: ["不接受实习"] } });
  try {
    await page.run();
    assert.deepEqual(page.chats, []);

    const again = await page.run();
    assert.deepEqual(page.chats, []);
    assert.ok(hasLog(again, /都已处理完/), again.join("\n"));

    page.removeTag("不接受实习");
    await page.run();
    assert.deepEqual(page.chats, ["job1", "job2"]);
  } finally {
    page.close();
  }
});

test("列表到底、剩下的都不符合规则时说明原因", async () => {
  const page = await openFakeBoss({ jobs: [1, 2, 3].map((i) => job(i)), storage: { zdlCoarseBlockedTags: ["java"] } });
  try {
    const lines = await page.run();
    assert.deepEqual(page.chats, []);
    assert.ok(hasLog(lines, /剩下的 3 个新岗位都不符合筛选规则（职位名排除"java" 3）/), lines.join("\n"));
  } finally {
    page.close();
  }
});
