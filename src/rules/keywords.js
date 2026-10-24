// 英文按整词匹配：关键词边缘是字母时，紧挨着的字符不能也是字母（java 不匹配 javascript），
// 中文不受影响。允许复数 s（agent 匹配 agents）；末尾加 * 表示前缀（spring* 匹配 springboot）。
// 关键词支持正则，不是合法正则时按普通文字匹配（如 c++）。
export const LETTER_EDGE = "(?:(?<![a-z])|(?![a-z]))";
export const keywordRegexCache = new Map();

// 按顶层的 | 拆开（括号、方括号里的不拆），这样“hr*|招聘|人事”里的 * 只作用于 hr
export function splitAlternatives(source) {
  const parts = [];
  let depth = 0, inClass = false, start = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "\\") { i++; continue; }
    if (inClass) { if (ch === "]") inClass = false; continue; }
    if (ch === "[") inClass = true;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "|" && depth === 0) { parts.push(source.slice(start, i)); start = i + 1; }
  }
  parts.push(source.slice(start));
  return parts;
}

// 每一段：末尾是“字母/数字 + *”时按前缀匹配，否则按整词匹配（允许复数 s）
export const alternativeSource = (alt) => (/[a-z0-9]\*$/i.test(alt)
  ? `(?:${alt.slice(0, -1)})`
  : `(?:${alt})s?${LETTER_EDGE}`);

export function keywordRegex(keyword) {
  let regex = keywordRegexCache.get(keyword);
  if (regex) return regex;
  const build = (source) => new RegExp(`${LETTER_EDGE}(?:${splitAlternatives(source).map(alternativeSource).join("|")})`, "i");
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const valid = (text) => { try { new RegExp(text); return true; } catch (error) { return false; } };
  try {
    regex = build(keyword);
  } catch (error) {
    // 只把写错的那一段当普通文字，比如“c++|java”里的 c++
    try {
      regex = build(splitAlternatives(keyword).map((alt) => (valid(alt) ? alt : escape(alt))).join("|"));
    } catch (error2) {
      regex = build(escape(keyword));
    }
  }
  keywordRegexCache.set(keyword, regex);
  return regex;
}

export function matchKeyword(text, keyword) {
  return keywordRegex(keyword).test(text);
}

// 截取关键词命中处前后的一小段原文，命中部分用「」标出，方便在日志里核对误伤。
export function keywordSnippet(text, keyword, radius = 10) {
  const match = keywordRegex(keyword).exec(text);
  if (!match) return "";
  const start = Math.max(0, match.index - radius);
  const end = Math.min(text.length, match.index + match[0].length + radius);
  const before = text.slice(start, match.index).trimStart();
  const after = text.slice(match.index + match[0].length, end).trimEnd();
  return `${start > 0 ? "…" : ""}${before}「${match[0]}」${after}${end < text.length ? "…" : ""}`;
}
