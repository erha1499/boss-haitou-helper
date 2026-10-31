import { CONFIG, RECRUITER_STATUS_OPTIONS } from "../config.js";
import { JOB_DEGREES, JOB_YEARS, normalizeJobTypeFilter } from "./job-type.js";
import { normalizeSalaryFilter } from "./salary.js";

// ---------- 求职向导 ----------
// 方向：include 写进“职位名包含任一”；exclusive 的方向没被选中时，signature 写进“职位名排除”。
// allows：选中该方向时，不排除这些方向（全栈本身就含前后端，AI 应用常写成“AI后端”）。
export const WIZARD_DIRECTIONS = [
  { key: "backend", label: "后端", exclusive: true, include: "后[端台]|服务端|服务器开发|server|[研开]发工程师|软件开发|软件工程师", signature: "后端|服务端" },
  { key: "fullstack", label: "全栈", exclusive: false, include: "全栈|full[- ]?stack", allows: ["backend", "frontend"] },
  { key: "ai", label: "AI应用/Agent", exclusive: false, include: "ai*|agent|智能体|大模型|llm|aigc|rag", allows: ["backend", "fullstack"] },
  { key: "frontend", label: "前端", exclusive: true, include: "前端|h5|vue|react|小程序", signature: "前端|h5" },
  { key: "testing", label: "测试", exclusive: true, include: "测试|测开|qa|质量保障", signature: "测试|测开|qa" },
  { key: "data", label: "数据/大数据", exclusive: true, include: "数据开发|大数据|数仓|etl|数据工程|spark|flink|bi", signature: "大数据|数仓|数据开发|etl" },
  { key: "algorithm", label: "算法", exclusive: true,
    include: "算法|机器学习|深度学习|强化学习|多模态|大模型训练|数据挖掘|计算机视觉|自然语言|语音识别|cv|nlp|ocr|slam|推荐|搜索",
    signature: "算法|机器学习|深度学习|强化学习|cv|nlp|推理优化" },
  { key: "client", label: "客户端/移动端", exclusive: true, include: "客户端|安卓|android|ios|移动端|鸿蒙|harmonyos|flutter|app开发", signature: "客户端|安卓|android|ios|移动端|鸿蒙|flutter" },
  { key: "embedded", label: "嵌入式/硬件", exclusive: true, include: "嵌入式|硬件|单片机|驱动|fpga|stm32|plc", signature: "嵌入式|硬件|单片机|fpga|驱动开发" },
  { key: "ops", label: "运维/DevOps", exclusive: true, include: "运维|devops|sre|k8s|云原生", signature: "运维|devops|sre" },
  { key: "game", label: "游戏", exclusive: true, include: "游戏|unity|ue[45]|cocos", signature: "游戏|unity|ue[45]" },
  { key: "security", label: "安全", exclusive: true, include: "安全|渗透|逆向", signature: "安全|渗透|逆向" },
];
// 技术栈：title 写进“职位名包含任一”（“Java开发”这类职位名），jd 写进“详情包含任一”
export const WIZARD_STACKS = [
  { key: "java", label: "Java", title: "java", jd: "java|spring*|mybatis|微服务" },
  { key: "python", label: "Python", title: "python", jd: "python|django|flask|fastapi" },
  { key: "go", label: "Go", title: "golang|go开发|go语言", jd: "golang|go语言|go开发|gin" },
  { key: "cpp", label: "C/C++", title: "c\\+\\+|cpp", jd: "c\\+\\+|cpp|qt" },
  { key: "js", label: "JS/TS", title: "javascript|typescript|node*", jd: "javascript|typescript|vue|react|node*" },
  { key: "php", label: "PHP", title: "php", jd: "php|laravel|thinkphp" },
  { key: "dl", label: "深度学习框架", title: "pytorch|tensorflow", jd: "pytorch|tensorflow|paddle*|cuda|transformers|深度学习框架" },
];
export const WIZARD_NON_TECH = "销售|客服|主播|电销|地推|售前|售后|技术支持|实施|运营|美术|原画|商务|产品经理|产品助理";
export const WIZARD_HR = "hr*|招聘|人事";
export const WIZARD_RECENT_STATUS = ["在线", "刚刚活跃", "今日活跃", "3日内活跃"];
export const WIZARD_YEARS_UP_TO = { 1: ["y0_1", "none"], 3: ["y0_1", "y1_3", "none"], 5: ["y0_1", "y1_3", "y3_5", "none"], all: JOB_YEARS.map(([k]) => k) };
export const defaultWizardAnswers = () => ({
  identities: [], maxYears: "3", degree: "", directions: [], stacks: [],
  minSalary: "", negotiable: true, onlyHr: false, recentActive: true, excludeNonTech: true,
});

// 由向导答案生成配置里向导负责的那几项；其他项（排除公司、工作地、详情排除、今日目标）保持不变
export function generateWizardConfig(answers) {
  const a = { ...defaultWizardAnswers(), ...answers };
  const selected = new Set(a.directions);
  const allowed = new Set();
  WIZARD_DIRECTIONS.filter((d) => selected.has(d.key)).forEach((d) => (d.allows || []).forEach((k) => allowed.add(k)));
  const includeTags = [
    ...WIZARD_DIRECTIONS.filter((d) => selected.has(d.key)).map((d) => d.include),
    ...WIZARD_STACKS.filter((s) => a.stacks.includes(s.key)).map((s) => s.title),
  ];
  const coarseBlockedTags = WIZARD_DIRECTIONS
    .filter((d) => d.exclusive && !selected.has(d.key) && !allowed.has(d.key))
    .map((d) => d.signature);
  if (a.excludeNonTech) coarseBlockedTags.push(WIZARD_NON_TECH);
  const types = [...a.identities];
  const years = WIZARD_YEARS_UP_TO[a.maxYears] || WIZARD_YEARS_UP_TO.all;
  const min = String(parseInt(a.minSalary, 10) || "");
  return {
    jobTypeFilter: normalizeJobTypeFilter({ types, years: a.identities.includes("social") ? years : JOB_YEARS.map(([k]) => k), degree: JOB_DEGREES.some(([k]) => k === a.degree) ? a.degree : "" }),
    includeTags,
    coarseRequiredTags: [],
    coarseBlockedTags,
    detailRequiredTags: [],
    detailOptionalTags: WIZARD_STACKS.filter((s) => a.stacks.includes(s.key)).map((s) => s.jd),
    // 向导填的是月薪：校招、社招直接用，实习折成日薪
    salaryFilter: normalizeSalaryFilter({
      intern: { min: min ? String(Math.round(Number(min) * 1000 / CONFIG.WORK_DAYS_PER_MONTH)) : "" },
      campus: { min }, social: { min }, negotiable: a.negotiable !== false,
    }),
    recruiterIncludeTags: a.onlyHr ? [WIZARD_HR] : [],
    recruiterActivityStatus: a.recentActive ? [...WIZARD_RECENT_STATUS] : [...RECRUITER_STATUS_OPTIONS],
  };
}

// 向导生成的关键词是一长串写法（如“后[端台]|服务端|…”），界面上用名字代替。
// 只认和向导生成的原文完全一致的关键词，用户改过的照原样显示。
const WIZARD_KEYWORD_NAMES = new Map();
const nameKeyword = (keyword, name) => {
  if (keyword && keyword.includes("|") && !WIZARD_KEYWORD_NAMES.has(keyword)) WIZARD_KEYWORD_NAMES.set(keyword, name);
};
WIZARD_DIRECTIONS.forEach((d) => {
  nameKeyword(d.include, `${d.label}方向`);
  nameKeyword(d.signature, `${d.label}方向`);
});
WIZARD_STACKS.forEach((s) => {
  nameKeyword(s.title, `${s.label}职位`);
  nameKeyword(s.jd, `${s.label}相关技术`);
});
nameKeyword(WIZARD_NON_TECH, "非技术岗（销售、客服、运营等）");
nameKeyword(WIZARD_HR, "HR / 招聘人员");

export const wizardKeywordName = (keyword) => WIZARD_KEYWORD_NAMES.get(keyword) || "";
