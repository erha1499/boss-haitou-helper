// 把 src/ 打包成单个用户脚本，写到仓库根目录（脚本管理器从这个文件检查更新）。
// 旧文件名下同时写一份相同的内容：从旧地址安装的用户更新一次后，脚本头里的更新地址就换成新文件名了。
// 用法：npm run build；加 --check 只检查已提交的脚本是否是最新构建，不写文件。
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";

const root = fileURLToPath(new URL("..", import.meta.url));
export const OUTPUT_FILE = `${root}boss-haitou-helper.user.js`;
export const LEGACY_OUTPUT_FILE = `${root}zdl改版-BOSS海投助手.user.js`;
const OUTPUT_FILES = [OUTPUT_FILE, LEGACY_OUTPUT_FILE];

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
  const code = await buildScript();
  if (process.argv.includes("--check")) {
    for (const file of OUTPUT_FILES) {
      const current = await readFile(file, "utf8").catch(() => "");
      if (current !== code) {
        console.error(`${file.slice(root.length)} 不是最新构建，请运行 npm run build`);
        process.exit(1);
      }
    }
    console.log("用户脚本已是最新构建");
  } else {
    for (const file of OUTPUT_FILES) await writeFile(file, code);
    console.log(`已生成 ${OUTPUT_FILES.map((file) => file.slice(root.length)).join("、")}`);
  }
}
