import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  getPromptText,
  installGlobalTargets,
  installSkill,
  type InstallResult,
} from "./install.js";

export interface SetupReport {
  readonly installed: readonly InstallResult[];
  readonly copiedToClipboard: boolean;
  readonly chatGptPromptFile: string;
}

export interface InitReport {
  readonly projectDir: string;
  readonly atomicDirsCreated: readonly string[];
  readonly scriptsAdded: readonly string[];
  readonly installed: readonly InstallResult[];
}

type ClipboardRunner = (text: string) => boolean;

const CLIPBOARD_CMD_BY_PLATFORM: Record<string, readonly [string, readonly string[]]> = {
  darwin: ["pbcopy", []],
  win32: ["clip", []],
};

function defaultClipboardRunner(text: string): boolean {
  const [cmd, args] = CLIPBOARD_CMD_BY_PLATFORM[process.platform] ?? [
    "xclip",
    ["-selection", "clipboard"],
  ];
  const res = spawnSync(cmd, [...args], { input: text, encoding: "utf8" });
  return res.status === 0;
}

export function runSetup(options: {
  readonly homeDir?: string;
  readonly copyToClipboard?: boolean;
  readonly clipboardRunner?: ClipboardRunner;
} = {}): SetupReport {
  const home = options.homeDir ?? homedir();
  const installed = installGlobalTargets(home);
  const compactPrompt = getPromptText({ compact: true });
  const promptDir = resolve(home, ".react-ub-mode");
  mkdirSync(promptDir, { recursive: true });
  const chatGptPromptFile = resolve(promptDir, "chatgpt-custom-instructions.md");
  writeFileSync(chatGptPromptFile, compactPrompt, "utf8");

  const runner = options.clipboardRunner ?? defaultClipboardRunner;
  const copiedToClipboard = options.copyToClipboard
    ? runner(compactPrompt)
    : false;

  return {
    installed,
    copiedToClipboard,
    chatGptPromptFile,
  };
}

function resolveAtomicBaseDirs(projectDir: string): string[] {
  const hasSrc = existsSync(resolve(projectDir, "src"));
  const hasRootApp = existsSync(resolve(projectDir, "app"));
  const hasSrcApp = existsSync(resolve(projectDir, "src/app"));

  if (hasSrcApp) {
    return [
      "src/components/atoms",
      "src/components/molecules",
      "src/components/organisms",
      "src/components/templates",
    ];
  }
  if (hasRootApp && !hasSrc) {
    return [
      "components/atoms",
      "components/molecules",
      "components/organisms",
      "components/templates",
    ];
  }
  return [
    "src/atoms",
    "src/molecules",
    "src/organisms",
    "src/templates",
    "src/pages",
  ];
}

function ensureAtomicDirectories(projectDir: string): string[] {
  const created: string[] = [];
  for (const rel of resolveAtomicBaseDirs(projectDir)) {
    const abs = resolve(projectDir, rel);
    if (!existsSync(abs)) {
      mkdirSync(abs, { recursive: true });
      created.push(rel);
    }
    if (readdirSync(abs).length === 0) {
      writeFileSync(resolve(abs, ".gitkeep"), "", "utf8");
    }
  }
  return created;
}

function parsePackageJson(pkgPath: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function addProjectScripts(projectDir: string): string[] {
  const pkgPath = resolve(projectDir, "package.json");
  if (!existsSync(pkgPath)) {
    return [];
  }
  const pkg = parsePackageJson(pkgPath);
  if (!pkg) {
    return [];
  }
  const existing =
    typeof pkg.scripts === "object" && pkg.scripts !== null
      ? (pkg.scripts as Record<string, string>)
      : {};
  const desired: Record<string, string> = {
    "ub:gate": "react-ub gate src",
    "ub:audit": "react-ub react-audit src",
    "ub:mutate": "react-ub mutator src --run",
  };
  const added: string[] = [];
  const nextScripts = { ...existing };
  for (const [key, value] of Object.entries(desired)) {
    if (!(key in nextScripts)) {
      nextScripts[key] = value;
      added.push(key);
    }
  }
  if (added.length > 0) {
    pkg.scripts = nextScripts;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }
  return added;
}

export function runProjectInit(options: {
  readonly projectDir: string;
  readonly homeDir?: string;
  readonly withChatGpt?: boolean;
}): InitReport {
  const projectDir = resolve(options.projectDir);
  const atomicDirsCreated = ensureAtomicDirectories(projectDir);
  const scriptsAdded = addProjectScripts(projectDir);

  const installed: InstallResult[] = [
    ...installSkill({
      target: "copilot",
      cwd: projectDir,
      homeDir: options.homeDir,
    }),
    ...installSkill({
      target: "local",
      cwd: projectDir,
      homeDir: options.homeDir,
      withPlugin: true,
    }),
  ];

  if (options.withChatGpt) {
    installed.push(
      ...installSkill({
        target: "chatgpt",
        cwd: projectDir,
        homeDir: options.homeDir,
      }),
    );
  }

  return {
    projectDir,
    atomicDirsCreated,
    scriptsAdded,
    installed,
  };
}
