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


// 打开“可补投”面板，勾选指定岗位并补投，等补投结束
async function remedy(page, titles) {
  page.document.querySelector(".zdl-remedy-btn").click();
  const panel = page.document.querySelector("#zdl-remedy-panel");
  for (const row of panel.querySelectorAll(".zdl-remedy-row")) {
    if (titles.includes(row.querySelector(".zdl-hist-name").textContent)) {
      const box = row.querySelector("input");
      box.checked = true;
      box.dispatchEvent(new page.window.Event("change"));
    }
  }
  const before = page.logs().length;
  [...panel.querySelectorAll("button")].find((b) => /补投选中/.test(b.textContent)).click();
  const deadline = Date.now() + 20000;
  while (!page.logs().slice(before).some((line) => /本次补投成功/.test(line)) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await page.idle();
  return page.logs().slice(before);
}

test("被细筛误跳过的岗位可以在“可补投”里补投", async () => {
  const jobs = [job(1), job(2, { desc: "本岗位不接受实习生" }), job(3)];
  const page = await openFakeBoss({ jobs, storage: { detailBlockedTags: ["不接受实习"] } });
  try {
    const lines = await page.run();
    assert.deepEqual(page.chats, ["job1", "job3"]);
    assert.ok(hasLog(lines, /可补投复查/), lines.join("\n"));
    const btn = page.document.querySelector(".zdl-remedy-btn");
    assert.equal(btn.hidden, false);
    assert.equal(btn.textContent, "可补投 1");

    const remedyLines = await remedy(page, ["Java后端开发2"]);
    assert.deepEqual(page.chats, ["job1", "job3", "job2"]);
    assert.equal(page.stats().dailyCount, 3);
    assert.ok(hasLog(remedyLines, /补投已投递$/), remedyLines.join("\n"));
    assert.ok(hasLog(remedyLines, /本次补投成功 1 个，共选了 1 个/), remedyLines.join("\n"));
    assert.equal(btn.hidden, true, "补投后应从列表移除");
    assert.ok(page.contacted().includes("job2"));
  } finally {
    page.close();
  }
});

test("补投受今日目标限制：投满后不能补投，调高目标后可以", async () => {
  const jobs = [job(1, { desc: "本岗位不接受实习生" }), job(2), job(3)];
  const page = await openFakeBoss({ jobs, storage: { detailBlockedTags: ["不接受实习"], zdlTargetCount: "1" } });
  try {
    await page.run();
    assert.deepEqual(page.chats, ["job2"]);
    page.document.querySelector(".zdl-remedy-btn").click();
    const deliverBtn = () => [...page.document.querySelectorAll("#zdl-remedy-panel button")].find((b) => /补投|今日目标/.test(b.textContent));
    assert.equal(deliverBtn().disabled, true);
    assert.match(deliverBtn().textContent, /已达今日目标/);
    page.document.querySelector("#zdl-remedy-panel #zdl-hist-close").click();

    const target = page.document.querySelector(".zdl-target-input");
    target.value = "2";
    target.dispatchEvent(new page.window.Event("change"));
    await remedy(page, ["Java后端开发1"]);
    assert.deepEqual(page.chats, ["job2", "job1"]);
    assert.equal(page.stats().dailyCount, 2);
  } finally {
    page.close();
  }
});

test("不在当前页的岗位不能勾选，只给打开岗位页的链接", async () => {
  const jobs = [job(1), job(2, { desc: "本岗位不接受实习生" })];
  const page = await openFakeBoss({ jobs, storage: { detailBlockedTags: ["不接受实习"] } });
  try {
    await page.run();
    page.document.querySelector('li.job-card-box[data-id="job2"]').remove();
    page.document.querySelector(".zdl-remedy-btn").click();
    const row = page.document.querySelector("#zdl-remedy-panel .zdl-remedy-row");
    assert.equal(row.querySelector("input").disabled, true);
    assert.match(row.querySelector("a.zdl-remedy-action").href, /\/job_detail\/job2\.html$/);
  } finally {
    page.close();
  }
});

test("详情加载超时的岗位也能补投", async () => {
  const page = await openFakeBoss({ jobs: [1, 2, 3].map((i) => job(i)), storage: { includeTags: ["java"] }, detailBroken: true });
  try {
    await page.run();
    const btn = page.document.querySelector(".zdl-remedy-btn");
    assert.equal(btn.textContent, "可补投 3");
    btn.click();
    const rows = [...page.document.querySelectorAll("#zdl-remedy-panel .zdl-remedy-row")];
    assert.equal(rows.length, 3);
    assert.ok(rows.every((row) => row.querySelector(".zdl-remedy-reason").textContent === "详情加载超时"));
    assert.ok(rows.every((row) => !row.querySelector("input").disabled));
  } finally {
    page.close();
  }
});
