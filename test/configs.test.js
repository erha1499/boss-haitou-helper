// README 里的常用岗位配置：每套都要能在脚本的「导入配置」里导入。
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { CONFIGS_DIR } from "../scripts/build.js";
import { PRESETS } from "../scripts/presets.js";
import { matchKeyword } from "../src/rules/keywords.js";

// 导入校验在 settings-store.js 里，它加载时会读 localStorage，先借 jsdom 的浏览器环境
const { window } = new JSDOM("", { url: "https://www.zhipin.com/web/geek/jobs" });
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, location: window.location });
const { parseConfig } = await import("../src/settings-store.js");

test("每套常用岗位配置都能通过导入校验", async () => {
  for (const preset of PRESETS) {
    const text = await readFile(`${CONFIGS_DIR}${preset.file}`, "utf8");
    const config = parseConfig(text);
    assert.ok(config.includeTags.length, `${preset.file} 没有职位名包含词`);
    assert.ok(config.coarseBlockedTags.length, `${preset.file} 没有职位名排除词`);
  }
});

test("README 列出了每套常用岗位配置", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  for (const preset of PRESETS) assert.ok(readme.includes(`configs/${preset.file}`), `README 缺少 ${preset.file}`);
});

test("排除外包的关键词不误伤“非外包”", async () => {
  const text = await readFile(`${CONFIGS_DIR}${PRESETS[0].file}`, "utf8");
  const [keyword] = parseConfig(text).detailBlockedTags;
  assert.equal(matchKeyword("本岗位为外包驻场", keyword), true);
  assert.equal(matchKeyword("劳务派遣制", keyword), true);
  assert.equal(matchKeyword("非外包，正式编制", keyword), false);
  assert.equal(matchKeyword("不是外包岗位", keyword), false);
});
