// 把 src/ 打包成单个用户脚本，写到仓库根目录（脚本管理器从这个文件检查更新）。
// 用法：npm run build；加 --check 只检查已提交的脚本是否是最新构建，不写文件。
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";

const root = fileURLToPath(new URL("..", import.meta.url));
export const OUTPUT_FILE = `${root}zdl改版-BOSS海投助手.user.js`;

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
    const current = await readFile(OUTPUT_FILE, "utf8").catch(() => "");
    if (current !== code) {
      console.error("用户脚本不是最新构建，请运行 npm run build");
      process.exit(1);
    }
    console.log("用户脚本已是最新构建");
  } else {
    await writeFile(OUTPUT_FILE, code);
    console.log(`已生成 ${OUTPUT_FILE.slice(root.length)}`);
  }
}
