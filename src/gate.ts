import { resolve } from "node:path";
import { runCrapper } from "./crapper/index.js";
import { runDryer } from "./dryer/index.js";
import { runMutator } from "./mutator/index.js";
import { runReactAudit } from "./react-audit/index.js";
import { parseProjectFiles } from "./scanner.js";
import type { GateReport } from "./types.js";

export interface GateOptions {
  readonly targetPath: string;
  readonly maxCrap?: number;
  readonly dryerThreshold?: number;
  readonly coveragePath?: string;
  readonly strictWarnings?: boolean;
  readonly executeMutator?: boolean;
  readonly testCmd?: string;
  readonly maxMutants?: number;
  readonly minMutationScore?: number;
}

export function runGate(options: GateOptions): GateReport {
  const rootDir = resolve(options.targetPath);
  const files = parseProjectFiles(rootDir, rootDir);

  const crapper = runCrapper(files, {
    rootDir,
    maxCrap: options.maxCrap,
    coveragePath: options.coveragePath,
  });

  const dryer = runDryer(files, {
    threshold: options.dryerThreshold,
  });

  const reactAudit = runReactAudit(files, {
    strictWarnings: options.strictWarnings,
  });

  const mutator = runMutator(files, {
    rootDir,
    execute: options.executeMutator,
    testCmd: options.testCmd,
    maxMutants: options.maxMutants,
    minMutationScore: options.minMutationScore,
  });

  const passed =
    crapper.passed && dryer.passed && reactAudit.passed && mutator.passed;

  return {
    rootDir,
    crapper,
    dryer,
    reactAudit,
    mutator,
    passed,
  };
}
