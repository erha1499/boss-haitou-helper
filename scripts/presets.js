// README 里“常用岗位配置”的来源：每套配置 = 求职向导的选项 + 少量补充规则。
// 只有后端选了技术栈：向导会把技术栈名加进职位名包含词，测试、数据等方向选了会混进普通开发岗。
// npm run build 会把它们生成到 configs/ 目录，和用户在向导里选同样的选项得到的规则一致。
import { generateWizardConfig } from "../src/rules/wizard.js";

// 职位描述里写了外包、驻场、劳务派遣的不投；“非外包”“不是外包”不算
const NO_OUTSOURCING = "(?<!非|不是|拒绝|无)(?:外包|驻场|人力外派|劳务派遣)";

export const PRESETS = [
  {
    file: "java-backend-intern.json", title: "Java 后端 · 实习",
    answers: { identities: ["intern"], directions: ["backend"], stacks: ["java"] },
  },
  {
    file: "frontend-intern-campus.json", title: "前端 · 实习 / 校招",
    answers: { identities: ["intern", "campus"], directions: ["frontend"] },
  },
  {
    file: "ai-agent-intern-campus.json", title: "AI 应用 / Agent 开发 · 实习 / 校招",
    answers: { identities: ["intern", "campus"], directions: ["ai"] },
  },
  {
    file: "algorithm-intern.json", title: "算法 / 大模型 · 实习",
    answers: { identities: ["intern"], directions: ["algorithm"], stacks: ["dl"] },
  },
  {
    file: "testing-campus.json", title: "测试开发 · 校招",
    answers: { identities: ["campus"], directions: ["testing"] },
  },
  {
    file: "data-campus.json", title: "数据开发 · 校招",
    answers: { identities: ["campus"], directions: ["data"] },
  },
  {
    file: "go-backend-social-under-3y.json", title: "Go 后端 · 社招 3 年以内",
    answers: { identities: ["social"], maxYears: "3", directions: ["backend"], stacks: ["go"], minSalary: "15" },
  },
  {
    file: "java-backend-social-under-5y.json", title: "Java 后端 · 社招 5 年以内",
    answers: { identities: ["social"], maxYears: "5", directions: ["backend"], stacks: ["java"], minSalary: "20" },
  },
];

// 和脚本里“复制配置”导出的格式一致，可以直接在「导入配置」里粘贴
export function presetConfigText({ answers }) {
  const wizard = generateWizardConfig(answers);
  const config = {
    targetCount: 150,
    salaryFilter: wizard.salaryFilter,
    recruiterActivityStatus: wizard.recruiterActivityStatus,
    jobTypeFilter: wizard.jobTypeFilter,
    includeTags: wizard.includeTags,
    coarseRequiredTags: wizard.coarseRequiredTags,
    coarseBlockedTags: wizard.coarseBlockedTags,
    locationTags: [],
    blockedCompanies: [],
    detailBlockedTags: [NO_OUTSOURCING],
    detailRequiredTags: wizard.detailRequiredTags,
    detailOptionalTags: wizard.detailOptionalTags,
    recruiterIncludeTags: wizard.recruiterIncludeTags,
  };
  return `${JSON.stringify({ type: "zdl-boss-config", version: 1, config }, null, 2)}\n`;
}
