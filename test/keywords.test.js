import test from "node:test";
import assert from "node:assert/strict";
import { keywordSnippet, matchKeyword } from "../src/rules/keywords.js";

test("英文按整词匹配", () => {
  assert.equal(matchKeyword("java开发工程师", "java"), true);
  assert.equal(matchKeyword("javascript开发", "java"), false);
  assert.equal(matchKeyword("storage 工程师", "rag"), false);
  assert.equal(matchKeyword("rag 应用开发", "rag"), true);
});

test("允许复数 s", () => {
  assert.equal(matchKeyword("ai agents 开发", "agent"), true);
});

test("末尾 * 按前缀匹配", () => {
  assert.equal(matchKeyword("springboot", "spring*"), true);
  assert.equal(matchKeyword("springboot", "spring"), false);
  assert.equal(matchKeyword("aigc 产品", "ai*"), true);
});

test("| 分隔多种写法，* 只作用于所在的那一段", () => {
  assert.equal(matchKeyword("hrbp", "hr*|招聘|人事"), true);
  assert.equal(matchKeyword("招聘专员", "hr*|招聘|人事"), true);
  assert.equal(matchKeyword("技术总监", "hr*|招聘|人事"), false);
  assert.equal(matchKeyword("前端开发", "前端|客户端"), true);
});

test("中文不受整词限制", () => {
  assert.equal(matchKeyword("web前端开发", "前端"), true);
});

test("支持正则", () => {
  assert.equal(matchKeyword("要求3年以上工作经验", "\\d年.{1,5}工作经验"), true);
  assert.equal(matchKeyword("本岗位不限实习时长", "不.{0,3}实习"), true);
});

test("写错的正则按普通文字匹配，只影响写错的那一段", () => {
  assert.equal(matchKeyword("c++开发", "c++"), true);
  assert.equal(matchKeyword("c++开发", "c++|java"), true);
  assert.equal(matchKeyword("java开发", "c++|java"), true);
  assert.equal(matchKeyword("c开发", "c++"), false);
});

test("不区分大小写", () => {
  assert.equal(matchKeyword("JAVA 后端", "java"), true);
  assert.equal(matchKeyword("java 后端", "Java"), true);
});

test("日志片段用「」标出命中的原文", () => {
  assert.equal(keywordSnippet("本岗位不限实习时长", "不.{0,3}实习"), "本岗位「不限实习」时长");
  assert.equal(keywordSnippet("没有命中", "java"), "");
  const long = `${"甲".repeat(20)}java${"乙".repeat(20)}`;
  assert.equal(keywordSnippet(long, "java"), `…${"甲".repeat(10)}「java」${"乙".repeat(10)}…`);
});
