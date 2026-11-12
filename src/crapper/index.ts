import type { CrapMetric, CrapperReport, ParsedFile } from "../types.js";
import { calculateCyclomaticComplexity } from "./complexity.js";
import { getUnitCoveragePercent, loadCoverage } from "./coverage.js";

export interface CrapperOptions {
  readonly rootDir: string;
  readonly maxCrap?: number;
  readonly coveragePath?: string;
}

export function computeCrapScore(
  complexity: number,
  coveragePercent: number,
): number {
  const clampedCoverage = Math.max(0, Math.min(100, coveragePercent));
  const uncoveredRatio = 1 - clampedCoverage / 100;
  const raw = complexity * complexity * Math.pow(uncoveredRatio, 3) + complexity;
  return Math.round(raw * 100) / 100;
}

export function runCrapper(
  files: readonly ParsedFile[],
  options: CrapperOptions,
): CrapperReport {
  const threshold = options.maxCrap ?? 10;
  const coverage = loadCoverage(options.rootDir, options.coveragePath);
  const metrics: CrapMetric[] = [];

  for (const file of files) {
    if (file.isTest) {
      continue;
    }
    for (const unit of file.units) {
      const complexity = calculateCyclomaticComplexity(unit);
      const coveragePercent =
        Math.round(
          getUnitCoveragePercent(
            coverage,
            file.filePath,
            unit.startLine,
            unit.endLine,
          ) * 100,
        ) / 100;
      const crapScore = computeCrapScore(complexity, coveragePercent);
      metrics.push({
        unitName: unit.name,
        kind: unit.kind,
        filePath: unit.filePath,
        startLine: unit.startLine,
        endLine: unit.endLine,
        complexity,
        coveragePercent,
        crapScore,
        passed: crapScore < threshold,
      });
    }
  }

  metrics.sort((a, b) => b.crapScore - a.crapScore);
  const failingUnits = metrics.filter((m) => !m.passed).length;

  return {
    threshold,
    coverageSource: coverage?.sourcePath ?? null,
    totalUnits: metrics.length,
    failingUnits,
    metrics,
    passed: failingUnits === 0,
  };
}
