// 职位列表上方的栏目（「推荐」+ 用户的求职意向）和「推荐」下面的筛选下拉框。
// 切栏目、改筛选都不刷新页面，只是列表换了，所以每次点完都等列表换掉再继续。
import { BOSS } from "./boss/selectors.js";
import { CONFIG } from "./config.js";
import { ContactedJobs } from "./contacted.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const textOf = (el) => el?.textContent?.trim() || "";
const isActive = (el) => el.classList.contains(BOSS.activeClass);
const FILTER_KEYS = Object.keys(BOSS.filterBoxes);

// 列表前几个岗位的 id，用来判断列表有没有换掉
const listSignature = () => Array.from(document.querySelectorAll(BOSS.jobCard)).slice(0, 5)
  .map((card) => ContactedJobs.idOf(card)).join(",");

// 等列表换掉（或者超时），中途投递停了就不等了。返回列表是否变了。
// settle：换掉后再等列表一段时间不再变化（连点几个筛选条件时 BOSS 会连着重新加载几次）
async function waitListChange(before, isCurrent, timeoutMs = 10000, settle = false) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isCurrent()) return false;
    const now = listSignature();
    if (now && now !== before) {
      if (settle) await waitListStable(isCurrent);
      else await delay(500); // 让列表渲染完
      return true;
    }
    await delay(300);
  }
  return false;
}

async function waitListStable(isCurrent, quietMs = 1500, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let last = listSignature();
  let since = Date.now();
  while (Date.now() < deadline && isCurrent()) {
    await delay(300);
    const now = listSignature();
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= quietMs) {
      return;
    }
  }
}

// 依次点这些选项，每次之间停一下；中途停了就不点了。返回是否点过
async function clickAll(options, isCurrent) {
  let clicked = false;
  for (const option of options.filter(Boolean)) {
    if (!isCurrent()) break;
    option.click();
    clicked = true;
    await delay(CONFIG.BASIC_INTERVAL);
  }
  return clicked;
}

export const ExpectTabs = {
  // 栏目：[{ name, el, recommend }]，第一个是「推荐」；页面上没有栏目栏时返回空数组
  list() {
    const recommend = document.querySelector(BOSS.recommendTab);
    if (!recommend) return [];
    const items = Array.from(document.querySelectorAll(BOSS.expectTab), (el) => ({
      name: textOf(el.querySelector(BOSS.expectTabName)) || textOf(el), el, recommend: false,
    }));
    return [{ name: textOf(recommend) || "推荐", el: recommend, recommend: true }, ...items];
  },

  activeIndex(tabs = this.list()) {
    return tabs.findIndex((tab) => isActive(tab.el));
  },

  // 点栏目并等列表换掉
  async select(tab, isCurrent) {
    if (isActive(tab.el)) return true;
    const before = listSignature();
    tab.el.click();
    return waitListChange(before, isCurrent);
  },

  _box(key) {
    const label = BOSS.filterBoxes[key];
    return Array.from(document.querySelectorAll(BOSS.filterBox))
      .find((box) => textOf(box.querySelector(BOSS.filterBoxLabel)).startsWith(label)) || null;
  },

  // 当前选中的筛选条件：{ jobType: [...], experience: [...], degree: [...] }，找不到的下拉框不列出
  readFilters() {
    const result = {};
    FILTER_KEYS.forEach((key) => {
      const box = this._box(key);
      if (box) {
        result[key] = Array.from(box.querySelectorAll(BOSS.filterOption))
          .filter(isActive).map(textOf).filter((text) => text !== BOSS.filterAnyText);
      }
    });
    return result;
  },

  // 把筛选条件设成 wanted（选项文字数组，空数组表示不限）。求职类型是单选，其余多选（点一下切换选中）。
  // 返回是否改过。每次点击后 BOSS 都会重新拉列表，所以点得慢一点，最后等列表换掉。
  async applyFilters(wanted, isCurrent) {
    const before = listSignature();
    let clicked = false;
    for (const key of FILTER_KEYS) {
      const box = this._box(key);
      if (!box || !wanted[key]) continue;
      const options = Array.from(box.querySelectorAll(BOSS.filterOption));
      const find = (text) => options.find((option) => textOf(option) === text);
      const target = wanted[key].filter((text) => find(text));
      const current = options.filter(isActive).map(textOf).filter((text) => text !== BOSS.filterAnyText);
      if (target.length === current.length && target.every((text) => current.includes(text))) continue;
      let clicks;
      if (!target.length) clicks = [find(BOSS.filterAnyText)];
      else if (key === "jobType") clicks = [find(target[0])];
      else clicks = [...target.filter((t) => !current.includes(t)), ...current.filter((t) => !target.includes(t))].map(find);
      if (await clickAll(clicks, isCurrent)) clicked = true;
      if (!isCurrent()) return clicked;
    }
    if (clicked) await waitListChange(before, isCurrent, 6000, true);
    return clicked;
  },

  _industryOptions() {
    const box = document.querySelector(BOSS.industryBox);
    return box ? Array.from(box.querySelectorAll(BOSS.industryOption)) : null;
  },

  // 当前选中的公司行业；页面上没有这个筛选时返回 null
  readIndustries() {
    const options = this._industryOptions();
    return options && options.filter(isActive).map(textOf);
  },

  // 把公司行业设成 wanted（最多 3 个，空数组表示不限）。先取消多余的再选新的，免得超过 3 个被 BOSS 拒绝。
  // 返回是否改过
  async applyIndustries(wanted, isCurrent) {
    const options = this._industryOptions();
    if (!options) return false;
    const before = listSignature();
    const current = options.filter(isActive);
    const clicks = [
      ...current.filter((option) => !wanted.includes(textOf(option))),
      ...options.filter((option) => !isActive(option) && wanted.includes(textOf(option))),
    ];
    const clicked = await clickAll(clicks, isCurrent);
    if (clicked) await waitListChange(before, isCurrent, 6000, true);
    return clicked;
  },
};
