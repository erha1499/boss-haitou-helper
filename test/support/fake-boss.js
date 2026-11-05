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

// 列表上方的栏目和「推荐」的筛选下拉框（tabs 不传就没有栏目栏）
const FILTER_OPTIONS = {
  求职类型: ["不限", "全职", "兼职", "实习"],
  工作经验: ["不限", "在校生", "应届生", "经验不限", "1年以内", "1-3年", "3-5年", "5-10年", "10年以上"],
  学历要求: ["不限", "初中及以下", "中专/中技", "高中", "大专", "本科", "硕士", "博士"],
};
function tabsHtml(tabs) {
  if (!tabs) return "";
  const items = tabs.map((t) => `<a href="javascript:;" class="expect-item"><span class="text-content">${esc(t.name)}</span></a>`).join("");
  const boxes = Object.entries(FILTER_OPTIONS).map(([label, options]) => `<div class="condition-filter-select">
    <div class="current-select"><span class="placeholder-text">${label}</span></div>
    <div class="filter-select-dropdown"><ul>${options.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></div></div>`).join("");
  return `<div class="c-expect-select"><a href="javascript:;" class="synthesis active">推荐</a>
    <div class="expect-list">${items}</div></div><div class="filter-condition">${boxes}</div>`;
}

// session：预先放进 sessionStorage 的内容（模拟投递中自动刷新后的页面）
// tabs：[{ name, jobs }] 用户的求职意向，jobs 是点这个栏目后列表里的岗位；“推荐”栏目的岗位是 jobs
// filteredJobs：「推荐」选了筛选条件后列表里的岗位，不传就还是 jobs
export async function openFakeBoss({ jobs, filteredJobs = null, tabs = null, storage = {}, session = {}, detailDelay = 40, detailBroken = false } = {}) {
  const code = await readFile(OUTPUT_FILE, "utf8");
  const html = `<!doctype html><html><head></head><body>${tabsHtml(tabs)}
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
  Object.entries(session).forEach(([key, value]) => w.sessionStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)));

  // 详情区：点卡片后稍等一会儿再换成这个岗位的内容
  const byId = Object.fromEntries([...jobs, ...(filteredJobs || []), ...(tabs || []).flatMap((t) => t.jobs)].map((j) => [j.id, { ...j }]));
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
  const bindCards = () => doc.querySelectorAll("li.job-card-box").forEach((card) => {
    card.addEventListener("click", () => {
      if (detailBroken) return;
      w.setTimeout(() => showDetail(byId[card.dataset.id]), detailDelay);
    });
  });
  bindCards();

  // 栏目：点了换列表；筛选：求职类型单选，其余多选，点“不限”清空。记下当前选中的筛选条件
  const visitedTabs = ["推荐"];
  const filterHistory = [];
  if (tabs) {
    const list = doc.querySelector(".job-list");
    const tabEls = [doc.querySelector(".synthesis"), ...doc.querySelectorAll(".expect-item")];
    const tabJobs = [jobs, ...tabs.map((t) => t.jobs)];
    const anyFilter = () => doc.querySelector(".condition-filter-select li.active") !== null;
    const render = (list_) => w.setTimeout(() => { list.innerHTML = list_().map(cardHtml).join(""); bindCards(); }, 60);
    const recommendJobs = () => (anyFilter() && filteredJobs ? filteredJobs : jobs);
    tabEls.forEach((el, i) => el.addEventListener("click", () => {
      tabEls.forEach((other) => other.classList.toggle("active", other === el));
      visitedTabs.push(i ? tabs[i - 1].name : "推荐");
      render(() => (i ? tabJobs[i] : recommendJobs()));
    }));
    doc.querySelectorAll(".condition-filter-select").forEach((box) => {
      const label = box.querySelector(".placeholder-text").textContent;
      const lis = [...box.querySelectorAll("li")];
      lis.forEach((li) => li.addEventListener("click", () => {
        const text = li.textContent.trim();
        if (text === "不限") lis.forEach((x) => x.classList.remove("active"));
        else if (label === "求职类型") lis.forEach((x) => x.classList.toggle("active", x === li && !li.classList.contains("active")));
        else li.classList.toggle("active");
        filterHistory.push(`${label}:${text}`);
        // 和 BOSS 一样：改了筛选，列表整个重新加载（筛选会带到其他栏目，这里只模拟「推荐」）
        if (tabEls[0].classList.contains("active")) render(recommendJobs);
      }));
    });
  }
  const filters = () => Object.fromEntries([...doc.querySelectorAll(".condition-filter-select")].map((box) => [
    box.querySelector(".placeholder-text").textContent,
    [...box.querySelectorAll("li.active")].map((li) => li.textContent.trim()),
  ]));

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
    window: w, document: doc, errors, chats, logs, visitedTabs, filterHistory, filters,
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
