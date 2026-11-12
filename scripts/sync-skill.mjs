import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const sourcePath = resolve(rootDir, "SKILL.md");
const targetPath = resolve(rootDir, "plugin/skills/react-ub-mode/SKILL.md");

const checkOnly = process.argv.includes("--check");
const sourceContent = readFileSync(sourcePath, "utf8");

if (checkOnly) {
  let targetContent = "";
  try {
    targetContent = readFileSync(targetPath, "utf8");
  } catch {
    console.error(`Missing synced skill at ${targetPath}`);
    process.exit(1);
  }
  if (sourceContent !== targetContent) {
    console.error(`SKILL.md out of sync with ${targetPath}. Run npm run build.`);
    process.exit(1);
  }
  console.log("SKILL.md is in sync.");
} else {
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, sourceContent, "utf8");
}
