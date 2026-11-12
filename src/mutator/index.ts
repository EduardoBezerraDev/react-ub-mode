import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type {
  MutantCandidate,
  MutantResult,
  MutatorReport,
  ParsedFile,
} from "../types.js";
import { generateMutantsForFiles } from "./mutants.js";
import { auditTests } from "./behavior-audit.js";

export { generateMutantsForFiles, auditTests };

export interface MutatorOptions {
  readonly rootDir: string;
  readonly execute?: boolean;
  readonly testCmd?: string;
  readonly timeoutMs?: number;
  readonly maxMutants?: number;
  readonly minMutationScore?: number;
}

const COPY_IGNORED = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  ".next",
]);

function prepareIsolatedWorkspace(rootDir: string): string {
  const sandbox = mkdtempSync(join(tmpdir(), "react-ub-mutator-"));
  cpSync(rootDir, sandbox, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(rootDir.length).replace(/^[/\\]/, "");
      if (!rel) {
        return true;
      }
      const firstSegment = rel.split(/[/\\]/)[0];
      return !COPY_IGNORED.has(firstSegment);
    },
  });

  const nodeModulesSrc = resolve(rootDir, "node_modules");
  const nodeModulesDst = resolve(sandbox, "node_modules");
  if (existsSync(nodeModulesSrc) && !existsSync(nodeModulesDst)) {
    symlinkSync(nodeModulesSrc, nodeModulesDst, "dir");
  }
  return sandbox;
}

function buildCleanTestEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function runTestCommand(
  cwd: string,
  command: string,
  timeoutMs: number,
): "passed" | "failed" | "timeout" {
  const result = spawnSync(command, {
    cwd,
    env: buildCleanTestEnv(),
    shell: true,
    timeout: timeoutMs,
    stdio: "ignore",
  });
  if (result.error && "code" in result.error && result.error.code === "ETIMEDOUT") {
    return "timeout";
  }
  return result.status === 0 ? "passed" : "failed";
}

function evaluateMutants(
  rootDir: string,
  candidates: readonly MutantCandidate[],
  options: MutatorOptions,
): MutantResult[] {
  const testCmd = options.testCmd ?? "npm test";
  const timeoutMs = options.timeoutMs ?? 20_000;
  const limit = options.maxMutants ?? 50;
  const selected = candidates.slice(0, limit);
  const sandbox = prepareIsolatedWorkspace(rootDir);

  try {
    const baseline = runTestCommand(sandbox, testCmd, timeoutMs);
    if (baseline !== "passed") {
      return selected.map((m) => ({
        id: m.id,
        filePath: m.filePath,
        line: m.line,
        kind: m.kind,
        original: m.original,
        mutated: m.mutated,
        status: "error",
      }));
    }

    const results: MutantResult[] = [];
    for (const mutant of selected) {
      const targetFile = resolve(sandbox, mutant.filePath);
      const originalContent = readFileSync(targetFile, "utf8");
      const mutatedContent =
        originalContent.slice(0, mutant.start) +
        mutant.mutated +
        originalContent.slice(mutant.end);

      writeFileSync(targetFile, mutatedContent, "utf8");
      const outcome = runTestCommand(sandbox, testCmd, timeoutMs);
      writeFileSync(targetFile, originalContent, "utf8");

      const status =
        outcome === "failed"
          ? "killed"
          : outcome === "timeout"
            ? "timeout"
            : "survived";

      results.push({
        id: mutant.id,
        filePath: mutant.filePath,
        line: mutant.line,
        kind: mutant.kind,
        original: mutant.original,
        mutated: mutant.mutated,
        status,
      });
    }
    return results;
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

function computeMutationScore(
  execute: boolean,
  killed: number,
  survived: number,
  timeout: number,
): number | null {
  const evaluated = killed + survived + timeout;
  if (!execute || evaluated === 0) {
    return null;
  }
  return Math.round(((killed + timeout) / evaluated) * 10000) / 100;
}

function hasBlockingAuditIssue(issues: readonly { kind: string }[]): boolean {
  return issues.some(
    (issue) =>
      issue.kind === "no-assertions" || issue.kind === "implementation-coupling",
  );
}

export function runMutator(
  files: readonly ParsedFile[],
  options: MutatorOptions,
): MutatorReport {
  const auditIssues = auditTests(files);
  const candidates = generateMutantsForFiles(files);
  const execute = options.execute ?? false;

  const results = execute
    ? evaluateMutants(options.rootDir, candidates, options)
    : [];

  const killed = results.filter((r) => r.status === "killed").length;
  const survived = results.filter((r) => r.status === "survived").length;
  const timeout = results.filter((r) => r.status === "timeout").length;
  const errored = results.filter((r) => r.status === "error").length;
  const mutationScore = computeMutationScore(execute, killed, survived, timeout);

  const minScore = options.minMutationScore ?? 80;
  const mutationPassed =
    !execute ||
    (errored === 0 && (mutationScore === null || mutationScore >= minScore));

  return {
    testFilesScanned: files.filter((f) => f.isTest).length,
    auditIssues,
    mutantsGenerated: candidates.length,
    executed: execute,
    killed,
    survived,
    timeout,
    mutationScore,
    results,
    passed: !hasBlockingAuditIssue(auditIssues) && mutationPassed,
  };
}
