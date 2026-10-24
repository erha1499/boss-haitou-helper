import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LEGACY_OUTPUT_FILE, OUTPUT_FILE, buildScript } from "../scripts/build.js";

test("仓库里的用户脚本是 src/ 的最新构建（改了源码要先 npm run build）", async () => {
  const committed = await readFile(OUTPUT_FILE, "utf8");
  assert.ok(committed === await buildScript(), "用户脚本不是最新构建，请运行 npm run build");
});

test("旧文件名下的副本和新文件内容一致，老用户能从旧地址更新到新地址", async () => {
  const legacy = await readFile(LEGACY_OUTPUT_FILE, "utf8");
  assert.ok(legacy === await readFile(OUTPUT_FILE, "utf8"), "旧文件名下的副本不是最新构建，请运行 npm run build");
  assert.match(legacy, /^\/\/ @updateURL\s+\S+\/boss-haitou-helper\.user\.js$/m);
});

test("用户脚本以脚本头开头", async () => {
  const committed = await readFile(OUTPUT_FILE, "utf8");
  assert.match(committed, /^\/\/ ==UserScript==\n[\s\S]*?\/\/ ==\/UserScript==\n/);
});
