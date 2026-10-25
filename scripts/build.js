// 把 src/ 打包成单个用户脚本，写到仓库根目录（脚本管理器从这个文件检查更新），
// 同时把 scripts/presets.js 里的常用岗位配置生成到 configs/。
// 用法：npm run build；加 --check 只检查已提交的脚本是否是最新构建，不写文件。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import { PRESETS, presetConfigText } from "./presets.js";

const root = fileURLToPath(new URL("..", import.meta.url));
export const OUTPUT_FILE = `${root}boss-haitou-helper.user.js`;
export const CONFIGS_DIR = `${root}configs/`;

// 生成的全部文件：{ 路径: 内容 }
export async function buildAll() {
  const files = { [OUTPUT_FILE]: await buildScript() };
  PRESETS.forEach((preset) => { files[`${CONFIGS_DIR}${preset.file}`] = presetConfigText(preset); });
  return files;
}

export async function buildScript() {
  const meta = (await readFile(`${root}src/meta.js`, "utf8")).trimEnd();
  const bundle = await rollup({
    input: `${root}src/main.js`,
    // 不做摇树优化：代码都在用，关掉后输出和源码一致（否则常量会被内联成 3e3 这类写法）。
    treeshake: false,
    onwarn(warning, warn) {
      // 模块之间互相引用（界面 ↔ 投递流程）是有意的，只在函数里使用，不影响加载顺序。
      if (warning.code === "CIRCULAR_DEPENDENCY") return;
      warn(warning);
    },
  });
  const { output } = await bundle.generate({ format: "iife", banner: `${meta}\n`, indent: "  " });
  await bundle.close();
  return output[0].code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await buildAll();
  if (process.argv.includes("--check")) {
    for (const [file, content] of Object.entries(files)) {
      if (await readFile(file, "utf8").catch(() => "") !== content) {
        console.error(`${file.slice(root.length)} 不是最新构建，请运行 npm run build`);
        process.exit(1);
      }
    }
    console.log("用户脚本和常用岗位配置都已是最新构建");
  } else {
    await mkdir(CONFIGS_DIR, { recursive: true });
    for (const [file, content] of Object.entries(files)) await writeFile(file, content);
    console.log(`已生成 ${OUTPUT_FILE.slice(root.length)} 和 ${PRESETS.length} 套常用岗位配置`);
  }
}
