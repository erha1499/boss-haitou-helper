// ---------- 岗位类型与经验 ----------
// BOSS 的经验标签只有“在校生/应届生/经验不限/1年以内/1-3年/…”，没有“实习”，
// 所以综合卡片标签、职位名和职位描述来判断。
// 可选的岗位类型。没标类型（含“经验不限”）的岗位不在这里选：它们总会收集，打开详情后按职位描述再判断。
export const JOB_TYPES = [["intern", "实习"], ["campus", "校招/应届"], ["social", "社招"]];
export const JOB_YEARS = [["y0_1", "1年以内"], ["y1_3", "1-3年"], ["y3_5", "3-5年"], ["y5p", "5年以上"], ["none", "未写年限"]];
// 学历是包含关系：博士 ⊃ 硕士 ⊃ 本科。选哪一档就投要求不高于它的岗位，空字符串表示不限。
export const JOB_DEGREES = [["bachelor", "本科"], ["master", "硕士"], ["doctor", "博士"]];
export const JOB_DEGREE_LABEL = Object.fromEntries(JOB_DEGREES);
const DEGREE_RANK = { bachelor: 1, master: 2, doctor: 3 };
const TAG_DEGREE_RANK = { 本科: 1, 硕士: 2, 博士: 3 };
export const JOB_TYPE_LABEL = Object.fromEntries(JOB_TYPES);
export const JOB_YEARS_LABEL = Object.fromEntries(JOB_YEARS);
// 日志里显示的具体类型名（“经验不限”和“未标明”在筛选上是同一档，显示时区分开）
export const JOB_SIGNAL_LABEL = { intern: "实习", campus: "校招/应届", social: "社招", open: "经验不限" };
// 旧配置里的“经验不限/未标明”（open、any、unknown）现在不用选，读取时丢掉
export const LEGACY_JOB_TYPES = { any: "open", unknown: "open", open: "open" };

export function normalizeJobTypeFilter(value) {
  const pick = (list, all, legacy = {}) => {
    if (!Array.isArray(list)) return all.map(([k]) => k);
    const mapped = list.map((k) => legacy[k] || k);
    return all.map(([k]) => k).filter((k) => mapped.includes(k));
  };
  const degree = JOB_DEGREE_LABEL[value?.degree] ? value.degree : "";
  return { types: pick(value?.types, JOB_TYPES, LEGACY_JOB_TYPES), years: pick(value?.years, JOB_YEARS), degree };
}

// 学历只在选了实习或校招时生效（界面上也只在那时出现）
export const activeDegree = (filter) => (filter.degree && (filter.types.includes("intern") || filter.types.includes("campus")) ? filter.degree : "");

// 岗位学历要求高于所选学历时返回要求的学历名；标签里没写学历、学历不限、大专及以下都不拦截
export function degreeRejectBy(tags, filter) {
  const degree = activeDegree(filter);
  if (!degree) return "";
  const required = tags.map((t) => t.trim()).find((t) => TAG_DEGREE_RANK[t]);
  return required && TAG_DEGREE_RANK[required] > DEGREE_RANK[degree] ? required : "";
}

export const CN_DIGITS = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
export function parseYearNumber(text) {
  if (/^\d+$/.test(text)) return Number(text);
  if (text.length === 1) return CN_DIGITS[text] ?? NaN;
  if (text[0] === "十") return 10 + (CN_DIGITS[text[1]] ?? NaN);
  if (text[1] === "十") return (CN_DIGITS[text[0]] ?? NaN) * 10;
  return NaN;
}
export const yearsBucket = (n) => (n < 1 ? "y0_1" : n < 3 ? "y1_3" : n < 5 ? "y3_5" : "y5p");

// 命中位置前面紧挨着否定词时不算，比如“不接受实习生”“非应届”“不设实习期”
export const isNegated = (text, index) => /(不接受|不招收?|不要求?|不考虑|不需要|不设|不提供|无需|不是|非)$/.test(text.slice(Math.max(0, index - 5), index));
// 命中位置后面跟着“优先/加分”等，说明只是加分项，不是硬性要求
export const isPreferred = (text, end) => /^[^，,。；;！!\n]{0,4}?(?:者|的)?(?:优先|更佳|为佳|最佳|加分|更好)/.test(text.slice(end, end + 10));
export function findSignal(text, regex, guard) {
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(text))) {
    if (!isNegated(text, match.index) && !(guard && guard(text, match))) return match;
  }
  return null;
}

export const N = "(\\d{1,2}|[一二两三四五六七八九十]{1,2})";
export const JT_TITLE_INTERN = /实习|(?<![a-z])intern(?:ship)?s?(?![a-z])/gi;
// 描述里单独的“毕业生”不算：社招常写“统招本科及以上毕业生”，只认“应届毕业生”“2027届”“2027年毕业生”这类说法
export const JT_CAMPUS = /应届(?:毕业)?生?|校园招聘|校招|秋招|春招|管培生?|(?<!\d)(?:20)?\d{2}\s*届|(?<!\d)20\d{2}\s*年?\s*(?:及以后)?毕业生/g;
// 职位名里写“毕业生”基本就是招应届生
export const JT_CAMPUS_TITLE = new RegExp(`${JT_CAMPUS.source}|毕业生`, "g");
// “每周5天”可能是正式岗的作息，只认“至少/不少于/到岗 N 天”或每周 1-4 天
export const JT_DESC_INTERN = /实习(?:期|生|岗|时长|周期|时间)|(?:每周|一周)(?:至少|不少于|到岗|出勤)\s*[\d一二三四五六]\s*天|(?:每周|一周)\s*[1-4一二三四]\s*天|可转正|转正机会|转正实习/g;
export const JT_SOCIAL = /社招|社会招聘/g;
export const JT_OPEN = /(?:工作)?经验不限|无需(?:工作)?经验|不限(?:工作)?经验|无(?:工作)?经验要求|接受(?:无经验|零基础)/g;
// “3年以上Java开发经验”“1-3年工作经验”“两年及以上相关经验”“3年+经验”
export const JT_YEARS = new RegExp(`(?<![\\d.])${N}\\s*\\+?\\s*(?:[-~～至到]\\s*${N}\\s*)?年\\s*\\+?(?:及|或)?(以上|以下|以内|左右)?(?:的)?([^，,。；;！!、\\n]{0,10}?)经验`, "g");
// “经验3年以上”“经验要求：3-5年”“工作年限：3年以上”
// 英文：“3+ years of experience”“at least 5 years' experience in Go”“2-4 yrs experience”
export const JT_YEARS_EN = /(?<![\d.])(\d{1,2})\s*\+?\s*(?:(?:-|~|to)\s*\d{1,2}\s*)?\+?\s*(?:years?|yrs?)['’]?\s+((?:[\w+#./-]+\s+){0,4}?)experience/gi;
// 英文加分项：“… is a plus”“… preferred”“nice to have”
const isPreferredEn = (text, end) => /^[^.;\n]{0,40}?\b(?:preferred|is a plus|a plus|nice to have|bonus)\b/i.test(text.slice(end, end + 50));

export const JT_YEARS_AFTER = new RegExp(`(?:经验|工作年限|从业年限)(?:要求)?\\s*[:：]?\\s*${N}\\s*(?:[-~～至到]\\s*${N}\\s*)?年(以上|及以上|左右)?`, "g");

export function snippetAt(text, index, length, radius = 10) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, index).trimStart()}「${text.slice(index, index + length)}」`
    + `${text.slice(index + length, end).trimEnd()}${end < text.length ? "…" : ""}`;
}

export function descYearsRequirement(desc) {
  let best = null;
  const consider = (n, match, upperBound) => {
    if (!Number.isFinite(n) || n > 15) return;
    if (isNegated(desc, match.index) || isPreferred(desc, match.index + match[0].length)) return;
    if (upperBound) {
      if (n > 1) return; // “3年以下经验”只是上限，不当作硬性要求
      n = 0;
    }
    if (!best || n > best.years) best = { years: n, evidence: `详情：${snippetAt(desc, match.index, match[0].length)}` };
  };
  let match;
  JT_YEARS.lastIndex = 0;
  while ((match = JT_YEARS.exec(desc))) {
    if (/实习|在校|校园/.test(match[4] || "")) continue; // “1年以上实习经验”说的是对候选人的要求
    consider(parseYearNumber(match[1]), match, match[3] === "以下" || match[3] === "以内");
  }
  JT_YEARS_AFTER.lastIndex = 0;
  while ((match = JT_YEARS_AFTER.exec(desc))) consider(parseYearNumber(match[1]), match, false);
  JT_YEARS_EN.lastIndex = 0;
  while ((match = JT_YEARS_EN.exec(desc))) {
    if (/intern|co-?op|academic|research/i.test(match[2])) continue; // “1 year of internship experience”说的是候选人的经历
    if (isPreferredEn(desc, match.index + match[0].length)) continue;
    consider(Number(match[1]), match, false);
  }
  return best;
}

// 返回 { kind: "years" | "soft" | "unknown", label, evidence, bucket?, types? }
// years：写明了年限要求，属于硬性条件；soft：实习/校招/经验不限/社招等类型信号，命中任一勾选项即可。
export function classifyJob({ title = "", tags = [], desc = "", salary = "" }) {
  const soft = new Map();
  const addSoft = (type, evidence) => { if (!soft.has(type)) soft.set(type, evidence); };
  // 按天计薪（如“200-300元/天”）基本是实习岗，很多实习岗职位名里并不写“实习”
  if (/元\s*\/\s*[天日]/.test(salary)) addSoft("intern", `薪资「${salary}」`);
  let cardYears = null;
  tags.map((t) => t.trim()).forEach((tag) => {
    if (/^(在校|应届|在校\/应届|在校生|应届生|应届毕业生)$/.test(tag)) addSoft("campus", `标签「${tag}」`);
    else if (tag === "经验不限") addSoft("open", `标签「${tag}」`);
    else if (/^\d+\s*天\/周$/.test(tag)) addSoft("intern", `标签「${tag}」`);
    else if (/^1年以[内下]$/.test(tag)) cardYears = { years: 0, evidence: `标签「${tag}」` };
    else {
      const m = tag.match(/^(\d+)\s*-\s*\d+\s*年$/) || tag.match(/^(\d+)\s*年以上$/);
      if (m) cardYears = { years: Number(m[1]), evidence: `标签「${tag}」` };
    }
  });
  // “x个月”标签可能是实习周期，也可能是短期项目，只在没有写年限时当作实习信号
  const monthTag = tags.find((t) => /^\d+\s*个月$/.test(t.trim()));
  if (monthTag && !cardYears) addSoft("intern", `标签「${monthTag.trim()}」`);
  if (findSignal(title, JT_TITLE_INTERN)) addSoft("intern", `职位名「${title}」`);
  if (findSignal(title, JT_CAMPUS_TITLE)) addSoft("campus", `职位名「${title}」`);
  let descYears = null;
  if (desc) {
    // 正式岗的“试用期…可转正”，以及高级岗的“指导实习生”“带领新人和实习生”，都不是实习信号
    const notIntern = (text, m) => /试用期/.test(text.slice(Math.max(0, m.index - 12), m.index))
      || /(?:指导|带领|培养|管理|带教|辅导|培训)[^，,。；;！!\n]{0,4}$/.test(text.slice(Math.max(0, m.index - 10), m.index));
    [["intern", JT_DESC_INTERN, notIntern], ["campus", JT_CAMPUS], ["social", JT_SOCIAL], ["open", JT_OPEN]].forEach(([type, regex, guard]) => {
      const hit = findSignal(desc, regex, guard);
      if (hit) addSoft(type, `详情：${snippetAt(desc, hit.index, hit[0].length)}`);
    });
    descYears = descYearsRequirement(desc);
  }
  const internStrong = soft.has("intern");
  // BOSS 的实习岗经验一栏常写“在校/应届”，有实习信号时按实习处理
  if (internStrong) soft.delete("campus");
  // 卡片“1年以内”对实习岗只是默认值，不当作年限要求
  const hard = [internStrong && cardYears?.years < 1 ? null : cardYears, descYears]
    .filter(Boolean).sort((x, y) => y.years - x.years)[0];
  if (hard) {
    const bucket = yearsBucket(hard.years);
    return { kind: "years", bucket, label: `社招·${JOB_YEARS_LABEL[bucket]}`, evidence: hard.evidence };
  }
  if (soft.size > 1) soft.delete("open");
  if (soft.size) {
    const types = [...soft.keys()];
    return { kind: "soft", types, label: types.map((t) => JOB_SIGNAL_LABEL[t]).join("/"), evidence: soft.get(types[0]) };
  }
  return { kind: "unknown", label: "未标明", evidence: "" };
}

// filter 为 normalizeJobTypeFilter 的结果：{ types: [...], years: [...], degree }
export const isJobTypeFilterActive = (filter) => filter.types.length < JOB_TYPES.length
  || (filter.types.includes("social") && filter.years.length < JOB_YEARS.length)
  || !!activeDegree(filter);

export function jobTypeMatches(result, { types, years }) {
  if (result.kind === "years") return types.includes("social") && years.includes(result.bucket);
  if (result.kind === "soft") {
    return result.types.some((t) => t === "open"
      || (t === "social" ? types.includes("social") && years.includes("none") : types.includes(t)));
  }
  // 没标类型、描述里也看不出来的岗位照常投，不因为缺标签被过滤
  return true;
}
