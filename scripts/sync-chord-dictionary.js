const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourceDir = process.argv[2] || "/Users/mac/Documents/Codex/2026-08-29/new-chat-2/outputs/코드사전";
const targetDir = path.join(projectRoot, "chords", "general");
const appPath = path.join(projectRoot, "app.js");

if (!fs.existsSync(sourceDir)) {
  throw new Error(`코드사전 폴더를 찾을 수 없습니다: ${sourceDir}`);
}

function collectPngFiles(dir, base = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectPngFiles(fullPath, base);
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".png")) return [];
      return [path.relative(base, fullPath).split(path.sep).join("/")];
    })
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

const files = collectPngFiles(sourceDir);

files.forEach((file) => {
  const targetPath = path.join(targetDir, file);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(path.join(sourceDir, file), targetPath);
});

const appSource = fs.readFileSync(appPath, "utf8");
const nextList = `const CHORD_IMAGE_FILES = [\n${files.map((file) => `  ${JSON.stringify(file)},`).join("\n")}\n];`;
const nextSource = appSource.replace(/const CHORD_IMAGE_FILES = \[[\s\S]*?\];/, nextList);

if (nextSource === appSource) {
  throw new Error("app.js에서 CHORD_IMAGE_FILES 목록을 찾지 못했습니다.");
}

fs.writeFileSync(appPath, nextSource);
console.log(`Synced ${files.length} chord images from ${sourceDir}`);
