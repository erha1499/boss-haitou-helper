import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OUTPUT_FILE, buildAll } from "../scripts/build.js";

test("仓库里的用户脚本和常用岗位配置是最新构建（改了源码要先 npm run build）", async () => {
  for (const [file, content] of Object.entries(await buildAll())) {
    const committed = await readFile(file, "utf8").catch(() => "");
    assert.ok(committed === content, `${file} 不是最新构建，请运行 npm run build`);
  }
});

test("用户脚本以脚本头开头", async () => {
  const committed = await readFile(OUTPUT_FILE, "utf8");
  assert.match(committed, /^\/\/ ==UserScript==\n[\s\S]*?\/\/ ==\/UserScript==\n/);
});
