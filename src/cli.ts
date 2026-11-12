#!/usr/bin/env node
import { resolve } from "node:path";
import { runCrapper } from "./crapper/index.js";
import { runDryer } from "./dryer/index.js";
import {
  formatCrapperReport,
  formatDryerReport,
  formatGateReport,
  formatMutatorReport,
  formatReactAuditReport,
} from "./format.js";
import { runGate } from "./gate.js";
import { getPromptText, installSkill, type InstallTarget } from "./install.js";
import { runMutator } from "./mutator/index.js";
import { runProjectInit, runSetup } from "./onboard.js";
import { runReactAudit } from "./react-audit/index.js";
import { parseProjectFiles } from "./scanner.js";

interface ParsedArgs {
  readonly command: string;
  readonly positional: string[];
  readonly flags: Map<string, string | boolean>;
}

const VALID_TARGETS = new Set<InstallTarget>([
  "antigravity",
  "claude",
  "cursor",
  "opencode",
  "copilot",
  "vscode",
  "codex",
  "chatgpt",
  "local",
  "all",
]);

function parseCliArgs(argv: readonly string[]): ParsedArgs {
  const [command = "help", ...rest] = argv;
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const eqIndex = token.indexOf("=");
    if (eqIndex !== -1) {
      flags.set(token.slice(2, eqIndex), token.slice(eqIndex + 1));
      continue;
    }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      i += 1;
    } else {
      flags.set(key, true);
    }
  }

  return { command, positional, flags };
}

function getNumberFlag(
  flags: ReadonlyMap<string, string | boolean>,
  name: string,
): number | undefined {
  const val = flags.get(name);
  if (typeof val !== "string") {
    return undefined;
  }
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getStringFlag(
  flags: ReadonlyMap<string, string | boolean>,
  name: string,
): string | undefined {
  const val = flags.get(name);
  return typeof val === "string" ? val : undefined;
}

function printHelp(): void {
  console.log(`react-ub — React & TypeScript UB-Mode Quality Gates & Skill CLI

Quick Start:
  react-ub setup [--copy]        Install globally for Antigravity, Copilot, Codex, Claude, Cursor & ChatGPT
  react-ub init [dir] [--chatgpt] Onboard a React project (Atomic Design dirs, .github/, .agents/, package.json scripts)

Quality Gates:
  react-ub gate [path] [--json] [--strict] [--mutate] [--max-crap 10] [--threshold 0.8] [--coverage <file>]
  react-ub crapper [path] [--max-crap 10] [--coverage <file>] [--json]
  react-ub dryer [path] [--threshold 0.8] [--json]
  react-ub react-audit [path] [--strict] [--json]
  react-ub mutator [path] [--run] [--test-cmd "npm test"] [--max-mutants 50] [--min-score 80] [--json]

Manual Install & Prompts:
  react-ub install [--target antigravity|copilot|vscode|chatgpt|codex|claude|cursor|opencode|local|all] [--plugin]
  react-ub prompt [--compact]
`);
}

function outputResult<T>(
  data: T,
  asJson: boolean,
  formatter: (report: T) => string,
  passed: boolean,
): number {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatter(data));
  }
  return passed ? 0 : 1;
}

type CommandContext = {
  readonly targetPath: string;
  readonly asJson: boolean;
  readonly flags: ReadonlyMap<string, string | boolean>;
};

const COMMAND_HANDLERS: Record<string, (ctx: CommandContext) => number> = {
  help: () => {
    printHelp();
    return 0;
  },
  "--help": () => {
    printHelp();
    return 0;
  },
  "-h": () => {
    printHelp();
    return 0;
  },
  crapper: ({ targetPath, asJson, flags }) => {
    const files = parseProjectFiles(targetPath, targetPath);
    const report = runCrapper(files, {
      rootDir: targetPath,
      maxCrap: getNumberFlag(flags, "max-crap"),
      coveragePath: getStringFlag(flags, "coverage"),
    });
    return outputResult(report, asJson, formatCrapperReport, report.passed);
  },
  dryer: ({ targetPath, asJson, flags }) => {
    const files = parseProjectFiles(targetPath, targetPath);
    const report = runDryer(files, {
      threshold: getNumberFlag(flags, "threshold"),
    });
    return outputResult(report, asJson, formatDryerReport, report.passed);
  },
  "react-audit": ({ targetPath, asJson, flags }) => {
    const files = parseProjectFiles(targetPath, targetPath);
    const report = runReactAudit(files, {
      strictWarnings: flags.get("strict") === true,
    });
    return outputResult(report, asJson, formatReactAuditReport, report.passed);
  },
  mutator: ({ targetPath, asJson, flags }) => {
    const files = parseProjectFiles(targetPath, targetPath);
    const report = runMutator(files, {
      rootDir: targetPath,
      execute: flags.get("run") === true,
      testCmd: getStringFlag(flags, "test-cmd"),
      maxMutants: getNumberFlag(flags, "max-mutants"),
      minMutationScore: getNumberFlag(flags, "min-score"),
    });
    return outputResult(report, asJson, formatMutatorReport, report.passed);
  },
  gate: ({ targetPath, asJson, flags }) => {
    const report = runGate({
      targetPath,
      maxCrap: getNumberFlag(flags, "max-crap"),
      dryerThreshold: getNumberFlag(flags, "threshold"),
      coveragePath: getStringFlag(flags, "coverage"),
      strictWarnings: flags.get("strict") === true,
      executeMutator: flags.get("mutate") === true,
      testCmd: getStringFlag(flags, "test-cmd"),
      maxMutants: getNumberFlag(flags, "max-mutants"),
      minMutationScore: getNumberFlag(flags, "min-score"),
    });
    return outputResult(report, asJson, formatGateReport, report.passed);
  },
  install: ({ asJson, flags }) => {
    const rawTarget =
      getStringFlag(flags, "target") ??
      (flags.get("local") === true ? "local" : "antigravity");
    if (!VALID_TARGETS.has(rawTarget as InstallTarget)) {
      console.error(`Invalid install target: ${rawTarget}`);
      return 2;
    }
    const results = installSkill({
      target: rawTarget as InstallTarget,
      withPlugin: flags.get("plugin") === true,
    });
    if (asJson) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      for (const r of results) {
        console.log(`Installed ${r.kind} (${r.target}) -> ${r.destination}`);
      }
    }
    return 0;
  },
  prompt: ({ flags }) => {
    console.log(getPromptText({ compact: flags.get("compact") === true }));
    return 0;
  },
  setup: ({ asJson, flags }) => {
    const report = runSetup({ copyToClipboard: flags.get("copy") === true });
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
      return 0;
    }
    for (const r of report.installed) {
      console.log(`Installed ${r.kind} (${r.target}) -> ${r.destination}`);
    }
    console.log(`ChatGPT prompt saved -> ${report.chatGptPromptFile}`);
    if (report.copiedToClipboard) {
      console.log("ChatGPT Custom Instructions copied to clipboard (Cmd+V in ChatGPT).");
    } else {
      console.log("Tip: run `react-ub prompt --compact | pbcopy` to copy ChatGPT Custom Instructions.");
    }
    return 0;
  },
  init: ({ targetPath, asJson, flags }) => {
    const report = runProjectInit({
      projectDir: targetPath,
      withChatGpt: flags.get("chatgpt") === true,
    });
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
      return 0;
    }
    console.log(`Initialized react-ub-mode in ${report.projectDir}`);
    if (report.atomicDirsCreated.length > 0) {
      console.log(`  Atomic Design dirs: ${report.atomicDirsCreated.join(", ")}`);
    }
    if (report.scriptsAdded.length > 0) {
      console.log(`  package.json scripts added: ${report.scriptsAdded.join(", ")}`);
    }
    console.log("  VS Code Copilot & Antigravity (.github/ + .agents/) configured.");
    console.log("  Run `npm run ub:gate` (or `react-ub gate src`) anytime.");
    return 0;
  },
};

export function main(argv: readonly string[]): number {
  const { command, positional, flags } = parseCliArgs(argv);
  const handler = COMMAND_HANDLERS[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 2;
  }
  return handler({
    targetPath: resolve(positional[0] ?? "."),
    asJson: flags.get("json") === true,
    flags,
  });
}

const isMain =
  process.argv[1] &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;

if (isMain) {
  process.exitCode = main(process.argv.slice(2));
}
