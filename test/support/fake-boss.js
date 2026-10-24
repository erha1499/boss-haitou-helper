// 测试用的假 BOSS 职位页：左侧职位卡片，点开后右侧显示详情，点“立即沟通”弹出投递成功的弹窗。
// 在里面运行构建好的 .user.js，测的就是用户实际安装的那个文件。
// 脚本里有很多 1~8 秒的等待，这里把页面时钟加快 SPEED 倍，一个场景零点几秒跑完。
import { readFile } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
import { OUTPUT_FILE } from "../../scripts/build.js";

const SPEED = 50;
const UID = "12345678";

// job: { id, title, company, salary, tags, desc, active, recruiter, button, onChat }
//   button：详情里沟通按钮的文字，默认“立即沟通”；"" 表示没有按钮
//   onChat："greet"（默认，弹出投递成功）| "limit"（弹出 150 次上限）| "none"（没反应）
export const job = (id, extra = {}) => ({
  id: `job${id}`, title: `Java后端开发${id}`, company: `某某科技${id}`, salary: "15-25K",
  tags: ["1-3年", "本科"], desc: `负责后端服务开发，熟悉 Java、Spring。岗位编号 ${id}`,
  active: "刚刚活跃", recruiter: "某某科技·HR", button: "立即沟通", onChat: "greet", ...extra,
});

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function cardHtml(j) {
  return `<li class="job-card-box" data-id="${j.id}">
    <a href="/job_detail/${j.id}.html"><span class="job-name">${esc(j.title)}</span></a>
    <span class="job-salary">${esc(j.salary)}</span>
    <ul class="tag-list">${j.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <span class="boss-name">${esc(j.company)}</span><span class="company-location">杭州·西湖区</span>
  </li>`;
}

export async function openFakeBoss({ jobs, storage = {}, detailDelay = 40, detailBroken = false } = {}) {
  const code = await readFile(OUTPUT_FILE, "utf8");
  const html = `<!doctype html><html><head></head><body>
    <ul class="job-list">${jobs.map(cardHtml).join("")}</ul>
    <div class="job-detail-container"><div class="job-detail-box">
      <span class="job-name"></span><ul class="tag-list"></ul>
      <div class="job-detail-body"><div class="desc"></div></div>
      <span class="boss-active-time"></span><span class="boss-info-attr"></span>
      <a class="op-btn-chat"></a>
    </div></div>
    <script>window._PAGE = { uid: "${UID}" };</script>
  </body></html>`;

  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error.message));
  virtualConsole.on("error", (...args) => errors.push(args.map(String).join(" ")));
  const dom = new JSDOM(html, {
    url: "https://www.zhipin.com/web/geek/jobs?ka=header-jobs",
    runScripts: "outside-only", pretendToBeVisual: true, virtualConsole,
  });
  const w = dom.window;
  const doc = w.document;

  // 加快时钟：定时器按比例缩短，Date.now 按比例走快，两者保持一致
  const realSetTimeout = w.setTimeout.bind(w);
  const realSetInterval = w.setInterval.bind(w);
  const realNow = w.Date.now.bind(w.Date);
  const origin = realNow();
  w.setTimeout = (fn, ms = 0, ...args) => realSetTimeout(fn, ms / SPEED, ...args);
  w.setInterval = (fn, ms = 0, ...args) => realSetInterval(fn, Math.max(ms / SPEED, 1), ...args);
  w.Date.now = () => origin + (realNow() - origin) * SPEED;

  // jsdom 没有实现 <dialog> 的弹出和关闭
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new w.Event("close"));
  };
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.scrollTo = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  Object.defineProperty(w.navigator, "locks", { value: { request: async (name, options, callback) => callback({ name }) } });

  const store = { zdlTutorialSeen: "1", ...storage };
  Object.entries(store).forEach(([key, value]) => w.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)));

  // 详情区：点卡片后稍等一会儿再换成这个岗位的内容
  const byId = Object.fromEntries(jobs.map((j) => [j.id, { ...j }]));
  const detail = doc.querySelector(".job-detail-box");
  const chatBtn = doc.querySelector("a.op-btn-chat");
  let current = null;
  const showDetail = (j) => {
    current = j;
    detail.querySelector(".job-name").textContent = j.title;
    detail.querySelector(".tag-list").innerHTML = j.tags.map((t) => `<li>${esc(t)}</li>`).join("");
    detail.querySelector(".desc").textContent = j.desc;
    detail.querySelector(".boss-active-time").textContent = j.active;
    detail.querySelector(".boss-info-attr").textContent = j.recruiter;
    chatBtn.textContent = j.button;
  };
  doc.querySelectorAll("li.job-card-box").forEach((card) => {
    card.addEventListener("click", () => {
      if (detailBroken) return;
      w.setTimeout(() => showDetail(byId[card.dataset.id]), detailDelay);
    });
  });

  const chats = [];
  chatBtn.addEventListener("click", () => {
    if (!current || current.button !== "立即沟通") return;
    chats.push(current.id);
    const j = current;
    if (j.onChat === "none") return;
    w.setTimeout(() => {
      const dialog = doc.createElement("div");
      if (j.onChat === "limit") {
        dialog.className = "chat-block-dialog";
        dialog.innerHTML = '<div class="chat-block-body">今日沟通已达150次上限，休息一下明天再来</div><span class="default-btn sure-btn">知道了</span>';
        dialog.querySelector(".sure-btn").addEventListener("click", () => dialog.remove());
      } else {
        dialog.className = "greet-dialog";
        dialog.innerHTML = '<span class="default-btn cancel-btn">留在此页</span><span class="default-btn sure-btn">继续沟通</span>';
        dialog.querySelector(".cancel-btn").addEventListener("click", () => dialog.remove());
        j.button = "继续沟通";
        chatBtn.textContent = "继续沟通";
      }
      doc.body.appendChild(dialog);
    }, 100);
  });

  w.eval(code);
  w.dispatchEvent(new w.Event("load"));

  const logs = () => [...doc.querySelectorAll("#pro-log .zdl-log-item")].map((item) => item.textContent.replace(/^\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?/, "").trim());
  const startButton = () => [...doc.querySelectorAll("button")].find((b) => /开始投递|停止投递|正在停止|准备中/.test(b.textContent));
  const waitUntil = async (predicate, timeoutMs = 20000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`等待超时，日志：\n${logs().join("\n")}`);
  };
  await waitUntil(() => startButton());

  return {
    window: w, document: doc, errors, chats, logs,
    // 点“开始投递”并等这次投递结束。没设规则时会先弹确认框，默认点“仍然开始”；
    // noRulesChoice 传按钮文字可以点别的，传 null 表示不处理（留着确认框）。
    async run({ noRulesChoice = "仍然开始" } = {}) {
      const before = logs().length;
      await waitUntil(() => !startButton().disabled);
      startButton().click();
      let confirmText = "";
      await waitUntil(() => {
        const confirm = doc.querySelector(".zdl-confirm-dialog[open]");
        if (confirm) {
          confirmText = confirm.textContent;
          if (noRulesChoice === null) return true;
          [...confirm.querySelectorAll("button")].find((b) => b.textContent.trim() === noRulesChoice).click();
          return false;
        }
        return logs().length > before && startButton().textContent.includes("开始投递") && !doc.querySelector(".greet-dialog");
      });
      const lines = logs().slice(before);
      lines.confirmText = confirmText;
      return lines;
    },
    // 等到没有确认框且没有在投递
    async idle() {
      await waitUntil(() => !doc.querySelector(".zdl-confirm-dialog[open]") && startButton().textContent.includes("开始投递"));
    },
    stats() {
      const raw = JSON.parse(w.localStorage.getItem("zdlDeliveryStatsV1") || "null");
      return raw?.accounts?.[UID] || null;
    },
    contacted() {
      return JSON.parse(w.localStorage.getItem("zdlContactedJobsV1") || "{}")[UID] || [];
    },
    // 在筛选设置里删掉某条关键词（模拟用户改规则）
    removeTag(text) {
      const tag = [...doc.querySelectorAll(".zdl-tag")].find((el) => el.querySelector(".zdl-tag-text")?.textContent === text);
      if (!tag) throw new Error(`找不到关键词 ${text}`);
      tag.querySelector(".zdl-tag-remove").click();
    },
    close() {
      w.close();
    },
  };
}
