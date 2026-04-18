const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const DIRECTORIES = ["backend/src", "backend/tests", "apps/web-panel/src"];
const JS_EXTENSIONS = new Set([".js", ".cjs", ".mjs"]);
const TEXT_EXTENSIONS = new Set([".js", ".vue", ".md", ".json", ".yml", ".yaml"]);

function collectFiles(baseDir) {
  const targetDir = path.join(ROOT, baseDir);
  if (!fs.existsSync(targetDir)) return [];

  const stack = [targetDir];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const resolvedPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(resolvedPath);
        continue;
      }
      files.push(resolvedPath);
    }
  }

  return files;
}

function hasUtf8Bom(contentBuffer) {
  return contentBuffer.length >= 3 && contentBuffer[0] === 0xef && contentBuffer[1] === 0xbb && contentBuffer[2] === 0xbf;
}

function checkTextFile(filePath, errors) {
  const extension = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) return;

  const buffer = fs.readFileSync(filePath);
  if (hasUtf8Bom(buffer)) {
    errors.push(`BOM обнаружен: ${path.relative(ROOT, filePath)}`);
  }

  const content = buffer.toString("utf8");
  if (content.includes("<<<<<<<") || content.includes("=======") || content.includes(">>>>>>>")) {
    errors.push(`Конфликтные маркеры merge: ${path.relative(ROOT, filePath)}`);
  }
}

function checkJavaScriptSyntax(filePath, errors) {
  const extension = path.extname(filePath).toLowerCase();
  if (!JS_EXTENSIONS.has(extension)) return;

  try {
    execFileSync(process.execPath, ["--check", filePath], { stdio: "pipe" });
  } catch (error) {
    const relativeFile = path.relative(ROOT, filePath);
    const message = error?.stderr?.toString("utf8").trim() || "Не удалось проверить синтаксис";
    errors.push(`Синтаксическая ошибка: ${relativeFile}\n${message}`);
  }
}

function main() {
  const allFiles = DIRECTORIES.flatMap((directory) => collectFiles(directory));
  const errors = [];

  for (const filePath of allFiles) {
    checkTextFile(filePath, errors);
    checkJavaScriptSyntax(filePath, errors);
  }

  if (errors.length > 0) {
    console.error("❌ Lint gate не пройден:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`✅ Lint gate пройден. Проверено файлов: ${allFiles.length}`);
}

main();
