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
    // 投递历史记下了公司和岗位名
    const history = JSON.parse(page.window.localStorage.getItem("zdlDeliveryHistory"));
    const today = Object.values(history)[0];
    assert.deepEqual(today["某某科技1"].jobs, ["Java后端开发1"]);
    // 标签页标题提示投递完成
    assert.match(page.document.title, /^【投递完成】/);
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

test("没设规则时开始投递要先确认，选“打开求职向导”就不投", async () => {
  const page = await openFakeBoss({ jobs: [job(1), job(2)] });
  try {
    const wizard = await page.run({ noRulesChoice: null });
    assert.match(wizard.confirmText, /还没有设置筛选规则/);
    const button = [...page.document.querySelectorAll(".zdl-confirm-dialog button")].find((b) => b.textContent.trim() === "打开求职向导");
    button.click();
    await page.idle();
    assert.deepEqual(page.chats, []);
    assert.ok(page.document.querySelector(".zdl-wizard-dialog[open], dialog[open]"), "应打开求职向导");

    const lines = await page.run();
    assert.deepEqual(page.chats, ["job1", "job2"]);
    assert.ok(hasLog(lines, /筛选条件：未设置/), lines.join("\n"));
  } finally {
    page.close();
  }
});

test("有规则时不弹确认框；规则在日志里显示成摘要，完整内容折叠", async () => {
  const page = await openFakeBoss({ jobs: [job(1)], storage: { includeTags: ["后[端台]|服务端|服务器开发|server|[研开]发工程师|软件开发|软件工程师", "java"] } });
  try {
    const lines = await page.run({ noRulesChoice: null });
    assert.equal(lines.confirmText, "");
    assert.ok(hasLog(lines, /筛选条件：职位名 包含 2/), lines.join("\n"));
    const more = page.document.querySelector("#pro-log .zdl-log-more");
    assert.match(more.textContent, /职位名 · 包含任一：后端方向、java/);
  } finally {
    page.close();
  }
});

test("投递中显示状态行和标签页标题，手动停止后提示已停止", async () => {
  const jobs = [1, 2, 3, 4, 5, 6].map((i) => job(i));
  const page = await openFakeBoss({ jobs, storage: { includeTags: ["java"] } });
  try {
    const startButton = () => [...page.document.querySelectorAll("button")].find((b) => /开始投递|停止投递/.test(b.textContent));
    startButton().click();
    const status = page.document.querySelector(".zdl-run-status");
    const deadline = Date.now() + 10000;
    while (!(page.chats.length >= 1 && !status.hidden && /正在看：/.test(status.textContent)) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.match(status.textContent, /本次已投 \d+ · 跳过 \d+/);
    assert.match(page.document.title, /^【投递中 \d+\/150】/);

    startButton().click();
    await page.idle();
    assert.equal(status.hidden, true);
    assert.match(page.document.title, /^【已停止】/);
    assert.ok(page.logs().some((line) => /已手动停止投递/.test(line)));
  } finally {
    page.close();
  }
});

test("日志可以只看已投递或跳过的记录", async () => {
  const jobs = [job(1), job(2, { desc: "不接受实习生" }), job(3)];
  const page = await openFakeBoss({ jobs, storage: { detailBlockedTags: ["不接受实习"] } });
  try {
    await page.run();
    const tabs = [...page.document.querySelectorAll(".zdl-log-tab")];
    assert.deepEqual(tabs.map((t) => t.textContent), ["全部", "已投递 2", "跳过 1"]);
    tabs[2].click();
    const log = page.document.querySelector("#pro-log");
    assert.equal(log.dataset.filter, "skip");
    assert.equal(log.dataset.empty, undefined);
    page.document.querySelector(".zdl-log-clear").click();
    assert.equal(log.dataset.empty, "还没有跳过的岗位");
  } finally {
    page.close();
  }
});

test("投递中页面切到后台时提醒一次会变慢", async () => {
  const page = await openFakeBoss({ jobs: [1, 2, 3, 4].map((i) => job(i)), storage: { includeTags: ["java"] } });
  try {
    const running = page.run();
    const deadline = Date.now() + 10000;
    while (!page.chats.length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    const hide = (hidden) => {
      Object.defineProperty(page.document, "hidden", { value: hidden, configurable: true });
      page.document.dispatchEvent(new page.window.Event("visibilitychange"));
    };
    hide(true);
    hide(false);
    hide(true);
    const lines = await running;
    assert.equal(lines.filter((line) => /页面在后台时浏览器会限速/.test(line)).length, 1, lines.join("\n"));
  } finally {
    page.close();
  }
});

