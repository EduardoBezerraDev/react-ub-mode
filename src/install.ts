import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type InstallTarget =
  | "antigravity"
  | "claude"
  | "cursor"
  | "opencode"
  | "copilot"
  | "vscode"
  | "codex"
  | "chatgpt"
  | "local"
  | "all";

export interface InstallResult {
  readonly target: string;
  readonly destination: string;
  readonly kind: "skill" | "plugin" | "instructions" | "prompt";
}

function getPackageRoot(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidate = resolve(__dirname, "..");
  if (existsSync(resolve(candidate, "SKILL.md"))) {
    return candidate;
  }
  return resolve(candidate, "..");
}

function writeTargetFile(destDir: string, fileName: string, content: string): string {
  mkdirSync(destDir, { recursive: true });
  const destFile = resolve(destDir, fileName);
  writeFileSync(destFile, content, "utf8");
  return destFile;
}

function copySkillFile(sourceSkillPath: string, destDir: string): string {
  return writeTargetFile(destDir, "SKILL.md", readFileSync(sourceSkillPath, "utf8"));
}

function copyPluginDir(sourcePluginDir: string, destDir: string): string {
  mkdirSync(destDir, { recursive: true });
  cpSync(sourcePluginDir, destDir, { recursive: true, force: true });
  return destDir;
}

export function getPromptText(options: { readonly compact?: boolean } = {}): string {
  const pkgRoot = getPackageRoot();
  if (options.compact) {
    return readFileSync(resolve(pkgRoot, "chatgpt/CUSTOM_INSTRUCTIONS.md"), "utf8");
  }
  return readFileSync(resolve(pkgRoot, "SKILL.md"), "utf8");
}

function buildCopilotInstructions(pkgRoot: string): string {
  const rules = readFileSync(resolve(pkgRoot, "plugin/rules/AGENTS.md"), "utf8");
  return `---\napplyTo: "**/*.{ts,tsx,js,jsx}"\n---\n\n${rules}`;
}

const HOME_SKILL_DIRS: Partial<Record<InstallTarget, string>> = {
  antigravity: ".gemini/config/skills/react-ub-mode",
  claude: ".claude/skills/react-ub-mode",
  cursor: ".cursor/skills/react-ub-mode",
  opencode: ".config/opencode/skills/react-ub-mode",
  copilot: ".copilot/skills/react-ub-mode",
  vscode: ".copilot/skills/react-ub-mode",
  codex: ".codex/skills/react-ub-mode",
};

function installCopilotWorkspaceFiles(
  pkgRoot: string,
  cwd: string,
  targetLabel: string,
  results: InstallResult[],
): void {
  const skillSrc = resolve(pkgRoot, "SKILL.md");
  results.push({
    target: targetLabel,
    destination: writeTargetFile(
      resolve(cwd, ".github/instructions"),
      "react-ub-mode.instructions.md",
      buildCopilotInstructions(pkgRoot),
    ),
    kind: "instructions",
  });
  results.push({
    target: targetLabel,
    destination: copySkillFile(skillSrc, resolve(cwd, ".github/skills/react-ub-mode")),
    kind: "skill",
  });
}

function installCopilotFiles(
  pkgRoot: string,
  cwd: string,
  home: string,
  targetLabel: string,
  results: InstallResult[],
): void {
  const skillSrc = resolve(pkgRoot, "SKILL.md");
  installCopilotWorkspaceFiles(pkgRoot, cwd, targetLabel, results);
  results.push({
    target: targetLabel,
    destination: copySkillFile(skillSrc, resolve(home, ".copilot/skills/react-ub-mode")),
    kind: "skill",
  });
}

export function installGlobalTargets(homeDir = homedir()): InstallResult[] {
  const pkgRoot = getPackageRoot();
  const skillSrc = resolve(pkgRoot, "SKILL.md");
  const pluginSrc = resolve(pkgRoot, "plugin");
  const results: InstallResult[] = [];
  const globalTargets = [
    "antigravity",
    "copilot",
    "codex",
    "claude",
    "cursor",
    "opencode",
  ] as const;

  for (const t of globalTargets) {
    const relDir = HOME_SKILL_DIRS[t]!;
    results.push({
      target: t,
      destination: copySkillFile(skillSrc, resolve(homeDir, relDir)),
      kind: "skill",
    });
  }
  installPluginIfRequested("antigravity", homeDir, pluginSrc, true, results);
  return results;
}

function installChatGptFiles(
  pkgRoot: string,
  cwd: string,
  results: InstallResult[],
): void {
  const compact = getPromptText({ compact: true });
  const full = getPromptText({ compact: false });
  const combined = [
    "# ChatGPT Instructions — react-ub-mode",
    "",
    "## Option A: ChatGPT Custom Instructions (<= 1500 chars)",
    "",
    "```markdown",
    compact.trimEnd(),
    "```",
    "",
    "## Option B: ChatGPT Project / Custom GPT Instructions (Full)",
    "",
    "```markdown",
    full.trimEnd(),
    "```",
    "",
  ].join("\n");

  results.push({
    target: "chatgpt",
    destination: writeTargetFile(cwd, "react-ub-mode-chatgpt.md", combined),
    kind: "prompt",
  });
}

function installPluginIfRequested(
  t: Exclude<InstallTarget, "all">,
  baseDir: string,
  pluginSrc: string,
  withPlugin: boolean | undefined,
  results: InstallResult[],
): void {
  if (!withPlugin || !existsSync(pluginSrc)) {
    return;
  }
  if (t !== "local" && t !== "antigravity") {
    return;
  }
  const relPluginDir =
    t === "local"
      ? ".agents/plugins/react-ub-mode"
      : ".gemini/config/plugins/react-ub-mode";
  results.push({
    target: t,
    destination: copyPluginDir(pluginSrc, resolve(baseDir, relPluginDir)),
    kind: "plugin",
  });
}

export function installSkill(options: {
  readonly target: InstallTarget;
  readonly cwd?: string;
  readonly homeDir?: string;
  readonly withPlugin?: boolean;
}): InstallResult[] {
  const pkgRoot = getPackageRoot();
  const skillSrc = resolve(pkgRoot, "SKILL.md");
  const pluginSrc = resolve(pkgRoot, "plugin");
  const home = options.homeDir ?? homedir();
  const cwd = options.cwd ?? process.cwd();
  const results: InstallResult[] = [];

  const installSingle = (t: Exclude<InstallTarget, "all">): void => {
    if (t === "copilot" || t === "vscode") {
      installCopilotFiles(pkgRoot, cwd, home, t, results);
      return;
    }
    if (t === "chatgpt") {
      installChatGptFiles(pkgRoot, cwd, results);
      return;
    }
    const baseDir = t === "local" ? cwd : home;
    const relSkillDir =
      t === "local"
        ? ".agents/skills/react-ub-mode"
        : HOME_SKILL_DIRS[t] ?? ".agents/skills/react-ub-mode";

    results.push({
      target: t,
      destination: copySkillFile(skillSrc, resolve(baseDir, relSkillDir)),
      kind: "skill",
    });
    installPluginIfRequested(t, baseDir, pluginSrc, options.withPlugin, results);
  };

  if (options.target === "all") {
    for (const t of [
      "antigravity",
      "claude",
      "cursor",
      "opencode",
      "copilot",
      "codex",
      "chatgpt",
    ] as const) {
      installSingle(t);
    }
  } else {
    installSingle(options.target);
  }

  return results;
}
