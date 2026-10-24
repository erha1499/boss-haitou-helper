import { BOSS } from "./selectors.js";

export function cleanDesc(descElement) {
  if (!descElement) return "";
  // BOSS 会在描述里插入隐藏的干扰文字（如“现场<span>kanzhun</span>面试”），
  // 它们的隐藏样式写在描述内嵌的 <style> 里。先按样式找出这些元素整个删掉，再去掉 style 本身。
  const clone = descElement.cloneNode(true);
  const hiddenClasses = new Set();
  clone.querySelectorAll("style").forEach((style) => {
    const rules = style.textContent.match(/\.[\w-]+\s*\{[^}]*\}/g) || [];
    rules.forEach((rule) => {
      if (/display\s*:\s*none|visibility\s*:\s*hidden|width\s*:\s*0\.\d+px|font-size\s*:\s*0(?![.\d])/i.test(rule)) {
        hiddenClasses.add(rule.slice(1, rule.indexOf("{")).trim());
      }
    });
    style.remove();
  });
  clone.querySelectorAll("[class]").forEach((el) => {
    if ([...el.classList].some((cls) => hiddenClasses.has(cls))) el.remove();
  });
  clone.querySelectorAll("[style]").forEach((el) => {
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(el.getAttribute("style"))) el.remove();
  });
  let text = clone.textContent;
  // 兜底：样式规则变了时，仍去掉常见的干扰词（大小写不敏感），长模式优先
  text = text.replace(/来自\s*boss\s*直聘/gi, "");
  text = text.replace(/来自\s*boss/gi, "");
  text = text.replace(/boss\s*直聘/gi, "");
  text = text.replace(/\bboss\b|kanzhun/gi, "");
  text = text.replace(/直聘/g, "");
  // 去除换行、回车、制表符，压缩连续空白
  text = text.replace(/[\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
  return text;
}

export const NOT_DETAIL = `${BOSS.jobCard}, #boss-pro-panel, .zdl-settings-panel, .zdl-history-panel`;

export function getDetailRoot() {
  return document.querySelector(BOSS.detailDesc)?.closest(BOSS.detailRoot) || document;
}

// 优先在右侧详情区域里找；找不到时在整页找，但排除左侧列表卡片和脚本自己的面板。
export function findInDetail(selector) {
  const root = getDetailRoot();
  const inRoot = root !== document ? root.querySelector(selector) : null;
  return inRoot || Array.from(document.querySelectorAll(selector)).find((el) => !el.closest(NOT_DETAIL)) || null;
}

export function highlightCard(card) {
  document.querySelectorAll(".zdl-current-card").forEach((el) => el.classList.remove("zdl-current-card"));
  card?.classList.add("zdl-current-card");
}
