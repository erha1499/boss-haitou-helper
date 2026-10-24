import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OUTPUT_FILE, buildScript } from "../scripts/build.js";

test("仓库里的用户脚本是 src/ 的最新构建（改了源码要先 npm run build）", async () => {
  const committed = await readFile(OUTPUT_FILE, "utf8");
  assert.ok(committed === await buildScript(), "用户脚本不是最新构建，请运行 npm run build");
});

test("用户脚本以脚本头开头", async () => {
  const committed = await readFile(OUTPUT_FILE, "utf8");
  assert.match(committed, /^\/\/ ==UserScript==\n[\s\S]*?\/\/ ==\/UserScript==\n/);
});
